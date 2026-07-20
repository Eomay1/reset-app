import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App, { calculateAverageAnxietyReduction, getAnxietyChangeMessage, getCravingChangeMessage } from './App';
import AcupressureExercise from './components/AcupressureExercise';
import AcupressureSelection from './components/AcupressureSelection';

jest.mock('./supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: async () => ({ data: [], error: null })
      }),
      insert: async () => ({ data: [], error: null })
    })
  }
}));

beforeEach(() => {
  localStorage.clear();
});

const settleAppEffects = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

test('calculates average anxiety reduction, including increases, without duplicate sessions', () => {
  expect(calculateAverageAnxietyReduction([
    { id: 'reset-1', interventionType: 'craving_reset', anxietyBefore: 8, anxietyAfter: 4 },
    { id: 'reset-2', interventionType: 'craving_reset', anxietyBefore: 3, anxietyAfter: 5 },
    { id: 'reset-1', interventionType: 'craving_reset', anxietyBefore: 8, anxietyAfter: 4 },
    { id: 'missing-after', interventionType: 'craving_reset', anxietyBefore: 7 },
    { id: 'invalid', interventionType: 'craving_reset', anxietyBefore: '7', anxietyAfter: 3 },
    { id: 'acupressure', interventionType: 'acupressure', anxietyBefore: 9, anxietyAfter: 1 }
  ])).toBe('1.0');
});

test('average anxiety reduction has an empty state when no qualifying RESET exists', () => {
  expect(calculateAverageAnxietyReduction([])).toBeNull();
  expect(calculateAverageAnxietyReduction([
    { id: 'legacy', beforeScore: 8, afterScore: 4 },
    { id: 'partial', interventionType: 'craving_reset', anxietyBefore: 5 }
  ])).toBeNull();
});

test('formats standardized craving and anxiety outcome wording', () => {
  expect(getCravingChangeMessage(6, 2)).toBe('Craving decreased from 6 to 2.');
  expect(getCravingChangeMessage(4, 4)).toBe('Craving stayed the same at 4.');
  expect(getCravingChangeMessage(2, 5)).toBe('Craving increased from 2 to 5.');
  expect(getAnxietyChangeMessage(6, 2)).toBe('Anxiety decreased from 6 to 2.');
  expect(getAnxietyChangeMessage(4, 4)).toBe('Anxiety stayed the same at 4.');
  expect(getAnxietyChangeMessage(2, 5)).toBe('Anxiety increased from 2 to 5.');
  expect(getAnxietyChangeMessage(null, 3)).toBeNull();
  expect(getAnxietyChangeMessage(3, Number.NaN)).toBeNull();
});

test('homepage displays the anxiety average and an em dash when data is unavailable', async () => {
  const { unmount } = render(<App environment="production" />);
  await settleAppEffects();
  expect(screen.getByText('Average Anxiety Reduction').parentElement).toHaveTextContent('—');
  unmount();

  localStorage.setItem('sessionLog', JSON.stringify([
    { id: 'one', interventionType: 'craving_reset', anxietyBefore: 9, anxietyAfter: 5 },
    { id: 'two', interventionType: 'craving_reset', anxietyBefore: 4, anxietyAfter: 5 },
    { id: 'one', interventionType: 'craving_reset', anxietyBefore: 9, anxietyAfter: 5 },
    { id: 'old-record', beforeScore: 7, afterScore: 3 }
  ]));
  render(<App environment="production" />);
  await settleAppEffects();
  expect(screen.getByText('Average Anxiety Reduction').parentElement).toHaveTextContent('1.5');
});

const advanceToPostResetAnxiety = async ({ anxietyBefore = 6, cravingBefore = 5, cravingAfter = 3 } = {}) => {
  fireEvent.click(screen.getByRole('button', { name: /Craving Reset/i }));
  fireEvent.click(screen.getByRole('button', { name: String(cravingBefore) }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('heading', { name: /How anxious do you feel right now/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: String(anxietyBefore) }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue RESET' }));
  expect(screen.getByRole('heading', { name: 'Pause the impulse.' })).toBeInTheDocument();
  expect(screen.queryByText('Choose the number that best reflects your craving right now.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Continue Move on/i }));
  fireEvent.click(screen.getByRole('button', { name: String(cravingAfter) }));
  expect(screen.getByText(getCravingChangeMessage(cravingBefore, cravingAfter))).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  expect(screen.getByText(/after RESET/i)).toBeInTheDocument();
  expect(screen.queryByText(/^Anxiety (decreased|increased|stayed)/)).not.toBeInTheDocument();
};

const completeResetFlow = async ({ anxietyBefore = 6, anxietyAfter = 2, cravingBefore = 5, cravingAfter = 3 } = {}) => {
  await advanceToPostResetAnxiety({ anxietyBefore, cravingBefore, cravingAfter });
  fireEvent.click(screen.getByRole('button', { name: String(anxietyAfter) }));
  expect(screen.getByText(getAnxietyChangeMessage(anxietyBefore, anxietyAfter))).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('heading', { name: 'RESET Complete' });
};

test('final summary uses standardized craving no-change and increase wording', async () => {
  const first = render(<App environment="production" />);
  await settleAppEffects();
  await completeResetFlow({ cravingBefore: 4, cravingAfter: 4 });
  expect(screen.getByText('Craving stayed the same at 4.')).toBeInTheDocument();
  first.unmount();

  localStorage.clear();
  render(<App environment="production" />);
  await settleAppEffects();
  await completeResetFlow({ cravingBefore: 2, cravingAfter: 5 });
  expect(screen.getByText('Craving increased from 2 to 5.')).toBeInTheDocument();
});

test('RESET saves immediately once and offers Structure Planner when today has no plan', async () => {
  const { rerender, unmount } = render(<App environment="production" />);
  await settleAppEffects();
  await completeResetFlow();

  const savedSessions = JSON.parse(localStorage.getItem('sessionLog'));
  expect(savedSessions).toHaveLength(1);
  expect(savedSessions[0]).toEqual(expect.objectContaining({
    beforeScore: 5,
    afterScore: 3,
    reduction: 2,
    stressLevel: 2,
    anxietyBefore: 6,
    anxietyAfter: 2,
    anxietyReduction: 4,
    interventionType: 'craving_reset'
  }));
  expect(screen.getByText('Craving decreased from 5 to 3.')).toBeInTheDocument();
  expect(screen.getByText('Anxiety decreased from 6 to 2.')).toBeInTheDocument();
  expect(screen.getAllByText('Not set')).toHaveLength(3);
  expect(screen.getByText(/Your RESET has been recorded. Strengthen/)).toBeInTheDocument();

  rerender(<App environment="production" />);
  expect(JSON.parse(localStorage.getItem('sessionLog'))).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Complete Your Structure Plan' }));
  expect(screen.getByRole('heading', { name: /Build today’s structure/i })).toBeInTheDocument();

  unmount();
  render(<App environment="production" />);
  await settleAppEffects();
  expect(screen.getByText('Total Sessions').parentElement).toHaveTextContent('1');
});

test('RESET results display an existing Structure Plan saved for today', async () => {
  const todayPlan = {
    dateKey: new Date().toLocaleDateString('en-CA'),
    completedAt: new Date().toISOString(),
    wakeTime: '6:00',
    block: 'writing',
    connection: 'Friend'
  };
  localStorage.setItem('structurePlans', JSON.stringify([todayPlan]));
  render(<App environment="production" />);
  await settleAppEffects();
  await completeResetFlow();

  expect(screen.getByText('6:00')).toBeInTheDocument();
  expect(screen.getByText('writing')).toBeInTheDocument();
  expect(screen.getByText('Friend')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Complete Your Structure Plan' })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('sessionLog'))).toHaveLength(1);
});

test('saving a Structure Plan does not create a RESET history entry', async () => {
  render(<App environment="production" />);
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: /Structure Planner/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Lock It In' }));

  expect(JSON.parse(localStorage.getItem('structurePlans'))).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem('sessionLog') || '[]')).toHaveLength(0);
  expect(screen.queryByText(/anxious|anxiety/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Neutral' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Check-In' }));
  expect(await screen.findByText('RESET')).toBeInTheDocument();
});

test('RESET is not saved until post-RESET anxiety is submitted', async () => {
  render(<App environment="production" />);
  await settleAppEffects();
  await advanceToPostResetAnxiety({ anxietyBefore: 5 });
  expect(JSON.parse(localStorage.getItem('sessionLog') || '[]')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
});

test('RESET results describe unchanged anxiety without implying improvement', async () => {
  render(<App environment="production" />);
  await settleAppEffects();
  await completeResetFlow({ anxietyBefore: 4, anxietyAfter: 4 });
  expect(screen.getByText('Anxiety stayed the same at 4.')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('sessionLog'))[0].anxietyReduction).toBe(0);
});

test('RESET results describe an anxiety increase as a positive magnitude', async () => {
  render(<App environment="production" />);
  await settleAppEffects();
  await completeResetFlow({ anxietyBefore: 2, anxietyAfter: 5 });
  expect(screen.getByText('Anxiety increased from 2 to 5.')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('sessionLog'))[0].anxietyReduction).toBe(-3);
});

test('older RESET records without anxiety fields still load safely', async () => {
  localStorage.setItem('sessionLog', JSON.stringify([{
    date: '7/1/2026, 9:00:00 AM', beforeScore: 7, afterScore: 4, reduction: 3
  }]));
  render(<App environment="production" />);
  await settleAppEffects();
  expect(screen.getByText('Total Sessions').parentElement).toHaveTextContent('1');
});

test('development preview defaults to Consumer and toggles Analytics access', async () => {
  render(<App environment="development" />);
  await settleAppEffects();
  expect(screen.getByLabelText('Development Preview')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Consumer' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: /Analytics/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Craving Reset/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Guided Acupressure/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Structure Planner/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Nightly Review/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Administrator' }));
  expect(screen.getByRole('button', { name: /Analytics/i })).toBeInTheDocument();
  expect(localStorage.getItem('pulsewell_preview_role')).toBe('admin');
  fireEvent.click(screen.getByRole('button', { name: 'Consumer' }));
  expect(screen.queryByRole('button', { name: /Analytics/i })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('RESET')).toBeInTheDocument());
});

test('switching from the Analytics screen to Consumer returns home', async () => {
  render(<App environment="development" />);
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: 'Administrator' }));
  fireEvent.click(screen.getByRole('button', { name: /Analytics/i }));
  expect(await screen.findByText('Program Dashboard')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Consumer' }));
  expect(await screen.findByText('RESET')).toBeInTheDocument();
  expect(screen.queryByText('Program Dashboard')).not.toBeInTheDocument();
});

test('development restores only a valid stored preview role', async () => {
  localStorage.setItem('pulsewell_preview_role', 'admin');
  const { unmount } = render(<App environment="development" />);
  await settleAppEffects();
  expect(screen.getByRole('button', { name: /Analytics/i })).toBeInTheDocument();
  unmount();

  localStorage.setItem('pulsewell_preview_role', 'invalid-role');
  render(<App environment="development" />);
  await settleAppEffects();
  expect(screen.getByRole('button', { name: 'Consumer' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: /Analytics/i })).not.toBeInTheDocument();
});

test('production enforces Consumer mode and renders no preview or Analytics access', async () => {
  localStorage.setItem('pulsewell_preview_role', 'admin');
  render(<App environment="production" />);
  await settleAppEffects();
  expect(screen.queryByLabelText('Development Preview')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Analytics/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Craving Reset/i })).toBeInTheDocument();
});

const props = {
  exerciseId: 'pc6',
  displayName: 'Wrist Calm',
  pointName: 'PC6 (Neiguan)',
  image: 'pc6.png',
  marker: { x: 52.15, y: 81.25 },
  duration: 1,
  instructions: 'Apply comfortable pressure.',
  locationInstruction: 'Between the central tendons.',
  bilateral: true,
  requiresSideSwitch: true,
  sideLabels: ['First wrist', 'Opposite wrist']
};

const libraryExercises = [
  {
    id: 'pc6', displayName: 'Wrist Calm', pointName: 'PC6 (Neiguan)',
    description: 'Apply guided pressure to a point on the inner wrist using a timed visual rhythm.',
    buttonLabel: 'Start Wrist Calm'
  },
  {
    id: 'kd27', displayName: 'Chest Calm', pointName: 'KD27 (Shufu)',
    description: 'Apply steady, comfortable pressure to both points beneath the collarbones using a timed visual rhythm.',
    buttonLabel: 'Start Chest Calm'
  },
  {
    id: 'yintang', displayName: 'Mind Calm', pointName: 'Yintang',
    description: 'Apply gentle, comfortable pressure between the eyebrows using a timed visual rhythm.',
    buttonLabel: 'Start Mind Calm'
  }
];

test('acupressure selection shows all exercises, opens each one, and supports Back', () => {
  const onSelectExercise = jest.fn();
  const onBack = jest.fn();
  render(
    <AcupressureSelection
      exercises={libraryExercises}
      onSelectExercise={onSelectExercise}
      onBack={onBack}
    />
  );

  expect(screen.getByRole('heading', { name: 'Guided Acupressure' })).toBeInTheDocument();
  expect(screen.getByText('Wrist Calm')).toBeInTheDocument();
  expect(screen.getByText('Chest Calm')).toBeInTheDocument();
  expect(screen.getByText('Mind Calm')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start Wrist Calm' }));
  expect(onSelectExercise).toHaveBeenCalledWith('pc6');
  fireEvent.click(screen.getByRole('button', { name: 'Start Chest Calm' }));
  expect(onSelectExercise).toHaveBeenCalledWith('kd27');
  fireEvent.click(screen.getByRole('button', { name: 'Start Mind Calm' }));
  expect(onSelectExercise).toHaveBeenCalledWith('yintang');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('Yintang introduction and single interval use one marker with no side switch', () => {
  jest.useFakeTimers();
  const onComplete = jest.fn();
  render(
    <AcupressureExercise
      {...props}
      exerciseId="yintang"
      displayName="Mind Calm"
      pointName="Yintang"
      markers={[{ x: 49.90, y: 33.79 }]}
      duration={1}
      bilateral={false}
      requiresSideSwitch={false}
      showSideLabel={false}
      instructions="Apply gentle, comfortable pressure to the highlighted point between your eyebrows."
      activeInstruction="Apply gentle, comfortable pressure with one fingertip."
      activeSupportingText="Relax your jaw, soften your shoulders, and breathe naturally."
      completionText="You completed Mind Calm."
      onComplete={onComplete}
    />
  );

  expect(screen.getByRole('heading', { name: 'Mind Calm' })).toBeInTheDocument();
  expect(screen.getByText('Yintang')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(1);
  expect(screen.queryByText('First wrist')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(1);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('You completed Mind Calm.')).toBeInTheDocument();
  expect(screen.queryByText('Switch to your opposite wrist.')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(onComplete).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('Yintang restart resets to 60 seconds and Exit removes its pulse', () => {
  jest.useFakeTimers();
  const onExit = jest.fn();
  render(
    <AcupressureExercise
      {...props}
      exerciseId="yintang"
      displayName="Mind Calm"
      pointName="Yintang"
      markers={[{ x: 49.90, y: 33.79 }]}
      duration={60}
      bilateral={false}
      requiresSideSwitch={false}
      showSideLabel={false}
      onExit={onExit}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => jest.advanceTimersByTime(2000));
  expect(screen.getByText('58')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
  expect(screen.getByText('60')).toBeInTheDocument();
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('59')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Exit Exercise' }));
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(0);
  jest.useRealTimers();
});

test('KD27 runs two synchronized markers for one interval without a side switch', () => {
  jest.useFakeTimers();
  const onComplete = jest.fn();
  render(
    <AcupressureExercise
      {...props}
      exerciseId="kd27"
      displayName="Chest Calm"
      pointName="KD27 (Shufu)"
      markers={[{ x: 36.82, y: 45.26 }, { x: 63.09, y: 45.26 }]}
      duration={1}
      requiresSideSwitch={false}
      showSideLabel={false}
      activeInstruction="Apply steady, comfortable pressure to both points."
      activeSupportingText="Keep your shoulders relaxed and breathe naturally."
      completionText="You completed Chest Calm."
      onComplete={onComplete}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(2);
  expect(screen.queryByText('First wrist')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(2);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('You completed Chest Calm.')).toBeInTheDocument();
  expect(screen.queryByText('Switch to your opposite wrist.')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(onComplete).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('KD27 restart resets its single interval to 60 seconds and Exit cleans up', () => {
  jest.useFakeTimers();
  const onExit = jest.fn();
  render(
    <AcupressureExercise
      {...props}
      exerciseId="kd27"
      displayName="Chest Calm"
      markers={[{ x: 36.82, y: 45.26 }, { x: 63.09, y: 45.26 }]}
      duration={60}
      requiresSideSwitch={false}
      showSideLabel={false}
      onExit={onExit}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => jest.advanceTimersByTime(2000));
  expect(screen.getByText('58')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
  expect(screen.getByText('60')).toBeInTheDocument();
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Exit Exercise' }));
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(0);
  jest.useRealTimers();
});

test('runs both wrists with a deliberate side switch', () => {
  jest.useFakeTimers();
  const onComplete = jest.fn();
  render(<AcupressureExercise {...props} onComplete={onComplete} />);

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(screen.getByText('First wrist')).toBeInTheDocument();
  expect(document.querySelector('.acupressure-pulse-active')).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('Switch to your opposite wrist.')).toBeInTheDocument();
  expect(document.querySelector('.acupressure-pulse-active')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Opposite wrist')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('Nice work.')).toBeInTheDocument();
  expect(document.querySelector('.acupressure-pulse-active')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(onComplete).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('pause, resume, restart, and exit control timer activity', () => {
  jest.useFakeTimers();
  const onExit = jest.fn();
  render(<AcupressureExercise {...props} duration={3} onExit={onExit} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  act(() => jest.advanceTimersByTime(2000));
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(document.querySelector('.acupressure-pulse-active')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  expect(document.querySelector('.acupressure-pulse-active')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(document.querySelector('.acupressure-pulse-active')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Exit Exercise' }));
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(document.querySelector('.acupressure-pulse-active')).not.toBeInTheDocument();
  jest.useRealTimers();
});
