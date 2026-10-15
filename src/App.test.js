import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App, { calculateAverageAnxietyReduction, getAnxietyChangeMessage, getCravingChangeMessage } from './App';
import AcupressureExercise from './components/AcupressureExercise';
import AcupressureSelection from './components/AcupressureSelection';
import { supabase } from './supabaseClient';

jest.mock('./supabaseClient', () => {
  const insert = jest.fn();
  const select = jest.fn();
  const historyRange = jest.fn();
  const historyOrder = jest.fn(() => ({ range: historyRange }));
  const historyEq = jest.fn(() => ({ order: historyOrder }));
  return {
    supabase: {
      auth: { getSession: jest.fn() },
      from: jest.fn(() => ({
        select: (...args) => {
          select(...args);
          return {
            eq: historyEq,
            order: (...orderArgs) => select().order(...orderArgs)
          };
        },
        insert
      })),
      testMocks: { select, insert, historyRange }
    }
  };
});

const mockFrom = supabase.from;
const mockInsert = supabase.testMocks.insert;
const mockSelect = supabase.testMocks.select;
const mockHistoryRange = supabase.testMocks.historyRange;

beforeEach(() => {
  localStorage.clear();
  supabase.auth.getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: "user-owned-uuid" }, access_token: "mock-token" } }, error: null });
  mockFrom.mockReset();
  mockFrom.mockImplementation(() => ({
    select: (...args) => {
      mockSelect(...args);
      return {
        eq: () => ({ order: () => ({ range: mockHistoryRange }) }),
        order: (...orderArgs) => mockSelect().order(...orderArgs)
      };
    },
    insert: mockInsert
  }));
  mockInsert.mockReset();
  mockInsert.mockResolvedValue({ data: [], error: null });
  mockSelect.mockReset();
  mockSelect.mockReturnValue({
    order: async () => ({ data: [], error: null })
  });
  mockHistoryRange.mockReset().mockResolvedValue({ data: [], error: null });
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: {
      randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111')
    }
  });
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
  const { unmount } = render(<App environment="test-review" />);
  await settleAppEffects();
  expect(screen.getByText('Average Anxiety Reduction').parentElement).toHaveTextContent('—');
  unmount();

  localStorage.setItem('sessionLog', JSON.stringify([
    { id: 'one', interventionType: 'craving_reset', anxietyBefore: 9, anxietyAfter: 5 },
    { id: 'two', interventionType: 'craving_reset', anxietyBefore: 4, anxietyAfter: 5 },
    { id: 'one', interventionType: 'craving_reset', anxietyBefore: 9, anxietyAfter: 5 },
    { id: 'old-record', beforeScore: 7, afterScore: 3 }
  ]));
  render(<App environment="test-review" />);
  await settleAppEffects();
  expect(screen.getByText('Average Anxiety Reduction').parentElement).toHaveTextContent('1.5');
});

const advanceToPostResetAnxiety = async ({ anxietyBefore = 6, cravingBefore = 5, cravingAfter = 3 } = {}) => {
  fireEvent.click(screen.getByRole('button', { name: /Breathing RESET/i }));
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

test('RESET pre- and post-anxiety inputs allow 1 through 10 but not 0', async () => {
  render(<App environment="test-review" />);
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: /Breathing RESET/i }));
  fireEvent.click(screen.getByRole('button', { name: '5' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  expect(screen.getByRole('heading', { name: /How anxious do you feel right now/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '0' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue RESET' }));
  fireEvent.click(screen.getByRole('button', { name: /Continue Move on/i }));
  fireEvent.click(screen.getByRole('button', { name: '3' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

  expect(screen.getByText(/after RESET/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '0' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
});

test('final summary uses standardized craving no-change and increase wording', async () => {
  const first = render(<App environment="test-review" />);
  await settleAppEffects();
  await completeResetFlow({ cravingBefore: 4, cravingAfter: 4 });
  expect(screen.getByText('Craving stayed the same at 4.')).toBeInTheDocument();
  first.unmount();

  localStorage.clear();
  render(<App environment="test-review" />);
  await settleAppEffects();
  await completeResetFlow({ cravingBefore: 2, cravingAfter: 5 });
  expect(screen.getByText('Craving increased from 2 to 5.')).toBeInTheDocument();
});

test('RESET saves immediately once and offers Structure Planner when today has no plan', async () => {
  const { rerender, unmount } = render(<App environment="test-review" />);
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
    interventionType: 'craving_reset',
    sessionId: '11111111-1111-4111-8111-111111111111',
    syncStatus: 'synced'
  }));
  expect(mockInsert).toHaveBeenCalledTimes(1);
  expect(mockInsert).toHaveBeenCalledWith([
    expect.objectContaining({
      session_id: '11111111-1111-4111-8111-111111111111',
      craving_before: 5,
      craving_after: 3,
      stress_before: 6,
      stress_after: 2,
      stress_level: 2,
      client_completed_at: expect.any(String),
      intervention_type: 'craving_reset',
      user_id: null
    })
  ]);
  expect(screen.getByText('Craving decreased from 5 to 3.')).toBeInTheDocument();
  expect(screen.getByText('Anxiety decreased from 6 to 2.')).toBeInTheDocument();
  expect(screen.getAllByText('Not set')).toHaveLength(3);
  expect(screen.getByText(/Your RESET has been recorded. Strengthen/)).toBeInTheDocument();

  rerender(<App environment="test-review" />);
  expect(JSON.parse(localStorage.getItem('sessionLog'))).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Complete Your Structure Plan' }));
  expect(screen.getByRole('heading', { name: /Build today’s structure/i })).toBeInTheDocument();

  unmount();
  render(<App environment="test-review" />);
  await settleAppEffects();
  expect(screen.getByText('Total Sessions').parentElement).toHaveTextContent('1');
});

test('authenticated RESET writes use only the current authenticated user ID', async () => {
  render(<App environment="production" currentUser={{ id: 'user-owned-uuid' }} />);
  await settleAppEffects();
  await completeResetFlow();

  expect(mockInsert).toHaveBeenCalledWith([
    expect.objectContaining({
      session_id: '11111111-1111-4111-8111-111111111111',
      user_id: 'user-owned-uuid'
    })
  ]);
  expect(localStorage.getItem('sessionLog')).toBeNull();
  const authenticatedHistory = JSON.parse(
    localStorage.getItem('pulsewell:reset-history:v2:user:user-owned-uuid')
  );
  expect(authenticatedHistory.sessions[0]).toEqual(expect.objectContaining({
    sessionId: '11111111-1111-4111-8111-111111111111',
    syncStatus: 'synced'
  }));
});

test('authenticated dashboard uses merged cloud and per-user local history only', async () => {
  localStorage.setItem('sessionLog', JSON.stringify([{ id: 'legacy-device-row' }]));
  localStorage.setItem('pulsewell:reset-history:v2:user:user-owned-uuid', JSON.stringify({
    version: 2,
    sessions: [{ id: 'local-failed', sessionId: 'local-failed', syncStatus: 'failed' }]
  }));
  mockHistoryRange.mockResolvedValue({
    data: [{
      session_id: 'cloud-row', craving_before: 7, craving_after: 3,
      stress_before: 6, stress_after: 2, stress_level: 2,
      client_completed_at: '2026-09-02T12:00:00Z', created_at: '2026-09-02T12:01:00Z',
      intervention_type: 'craving_reset', user_id: 'user-owned-uuid'
    }],
    error: null
  });

  render(<App environment="production" currentUser={{ id: 'user-owned-uuid' }} />);
  await waitFor(() => expect(screen.getByText('Total Sessions').parentElement).toHaveTextContent('2'));
  expect(screen.getByText('Your RESET history')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('sessionLog'))).toEqual([{ id: 'legacy-device-row' }]);
});

test('fresh entitlement blocks starting a RESET after access expires', async () => {
  const refreshEntitlement = jest.fn().mockResolvedValue({
    effectiveStatus: 'trial_expired',
    hasAccess: false
  });
  const onAccessDenied = jest.fn();
  render(
    <App
      environment="production"
      currentUser={{ id: 'user-owned-uuid' }}
      refreshEntitlement={refreshEntitlement}
      onAccessDenied={onAccessDenied}
    />
  );
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: /Breathing RESET/i }));

  await waitFor(() => expect(onAccessDenied).toHaveBeenCalledTimes(1));
  expect(refreshEntitlement).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('heading', { name: /How strong is your craving/i })).not.toBeInTheDocument();
});

test('pre-RESET entitlement failure shows a retryable error without starting', async () => {
  const refreshEntitlement = jest.fn().mockRejectedValue(new Error('offline'));
  render(
    <App
      environment="production"
      currentUser={{ id: 'user-owned-uuid' }}
      refreshEntitlement={refreshEntitlement}
    />
  );
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: /Breathing RESET/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t verify your RESET access');
  expect(screen.getByRole('button', { name: 'Retry access check' })).toBeInTheDocument();
});

test('cloud failure keeps the local RESET, reports failure, and Retry reuses its session ID', async () => {
  const cloudError = new Error('network unavailable');
  mockInsert
    .mockResolvedValueOnce({ data: null, error: cloudError })
    .mockResolvedValueOnce({ data: null, error: { code: '23505' } });

  render(<App environment="test-review" />);
  await settleAppEffects();
  await completeResetFlow({
    cravingBefore: 8,
    cravingAfter: 3,
    anxietyBefore: 7,
    anxietyAfter: 4
  });

  let savedSessions = JSON.parse(localStorage.getItem('sessionLog'));
  expect(savedSessions).toHaveLength(1);
  expect(savedSessions[0]).toEqual(expect.objectContaining({
    sessionId: '11111111-1111-4111-8111-111111111111',
    syncStatus: 'failed',
    beforeScore: 8,
    afterScore: 3,
    anxietyBefore: 7,
    anxietyAfter: 4
  }));
  expect(screen.getByText('Your RESET was saved on this device, but cloud sync failed.')).toBeInTheDocument();
  expect(screen.queryByText('Your RESET has been recorded.')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Your RESET has been recorded.');

  savedSessions = JSON.parse(localStorage.getItem('sessionLog'));
  expect(savedSessions).toHaveLength(1);
  expect(savedSessions[0].syncStatus).toBe('synced');
  expect(mockInsert).toHaveBeenCalledTimes(2);
  expect(mockInsert.mock.calls[0][0][0].session_id).toBe(
    mockInsert.mock.calls[1][0][0].session_id
  );
  expect(mockInsert.mock.calls[1][0][0]).toEqual(expect.objectContaining({
    craving_before: 8,
    craving_after: 3,
    stress_before: 7,
    stress_after: 4,
    stress_level: 4
  }));
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
  render(<App environment="test-review" />);
  await settleAppEffects();
  await completeResetFlow();

  expect(screen.getByText('6:00')).toBeInTheDocument();
  expect(screen.getByText('writing')).toBeInTheDocument();
  expect(screen.getByText('Friend')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Complete Your Structure Plan' })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('sessionLog'))).toHaveLength(1);
});

test('saving a Structure Plan does not create a RESET history entry', async () => {
  render(<App environment="test-review" />);
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
  render(<App environment="test-review" />);
  await settleAppEffects();
  await advanceToPostResetAnxiety({ anxietyBefore: 5 });
  expect(JSON.parse(localStorage.getItem('sessionLog') || '[]')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
});

test('RESET results describe unchanged anxiety without implying improvement', async () => {
  render(<App environment="test-review" />);
  await settleAppEffects();
  await completeResetFlow({ anxietyBefore: 4, anxietyAfter: 4 });
  expect(screen.getByText('Anxiety stayed the same at 4.')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('sessionLog'))[0].anxietyReduction).toBe(0);
});

test('RESET results describe an anxiety increase as a positive magnitude', async () => {
  render(<App environment="test-review" />);
  await settleAppEffects();
  await completeResetFlow({ anxietyBefore: 2, anxietyAfter: 5 });
  expect(screen.getByText('Anxiety increased from 2 to 5.')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('sessionLog'))[0].anxietyReduction).toBe(-3);
});

test('older RESET records without anxiety fields still load safely', async () => {
  localStorage.setItem('sessionLog', JSON.stringify([{
    date: '7/1/2026, 9:00:00 AM', beforeScore: 7, afterScore: 4, reduction: 3
  }]));
  render(<App environment="test-review" />);
  await settleAppEffects();
  expect(screen.getByText('Total Sessions').parentElement).toHaveTextContent('1');
  expect(screen.getByText('History on this device')).toBeInTheDocument();
});

test('corrupted local RESET history falls back safely', async () => {
  localStorage.setItem('sessionLog', '{not valid json');
  render(<App environment="test-review" />);
  await settleAppEffects();
  expect(screen.getByText('Total Sessions').parentElement).toHaveTextContent('0');
  expect(screen.getByRole('button', { name: /Breathing RESET/i })).toBeInTheDocument();
});

test('development preview defaults to Consumer and toggles Analytics access', async () => {
  render(<App environment="development" />);
  await settleAppEffects();
  expect(screen.getByLabelText('Development Preview')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Consumer' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: /Analytics/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Breathing RESET/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Acupressure RESET/i })).toBeInTheDocument();
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
  expect(screen.getByRole('button', { name: /Breathing RESET/i })).toBeInTheDocument();
  expect(mockSelect).not.toHaveBeenCalled();
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
  expect(screen.queryByText('First wrist finished.')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Finish & Rate' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Exit Without Saving' }));
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
  expect(screen.queryByText('First wrist finished.')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.acupressure-pulse-active')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Finish & Rate' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Exit Without Saving' }));
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
  expect(screen.getByText('First wrist finished.')).toBeInTheDocument();
  expect(document.querySelector('.acupressure-pulse-active')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Continue with Opposite Wrist' }));
  expect(screen.getByText('Opposite wrist')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('Nice work.')).toBeInTheDocument();
  expect(document.querySelector('.acupressure-pulse-active')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Finish & Rate' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Exit Without Saving' }));
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(document.querySelector('.acupressure-pulse-active')).not.toBeInTheDocument();
  jest.useRealTimers();
});

const rateBefore = () => {
  fireEvent.click(screen.getByRole('button', { name: '6' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: '5' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
};
const rateAfter = async () => {
  fireEvent.click(screen.getByRole('button', { name: '3' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  fireEvent.click(screen.getByRole('button', { name: '2' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('heading', { name: 'RESET Complete' });
};

test('grounding saves ratings and type once, retries without duplicates, and clears state for the next session', async () => {
  mockInsert.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ error: null });
  crypto.randomUUID.mockReturnValueOnce('grounding-one').mockReturnValueOnce('device-one').mockReturnValueOnce('breathing-two');
  render(<App environment="test-review" />);
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: /Grounding RESET/i }));
  rateBefore();
  for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Skip step' }));
  expect(mockInsert).not.toHaveBeenCalled();
  await rateAfter();
  expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({ intervention_type: 'grounding_reset', craving_before: 6, craving_after: 3, stress_before: 5, stress_after: 2 })]);
  expect(screen.queryByText('Channel Action')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('heading', { name: 'RESET Complete' });
  expect(mockInsert).toHaveBeenCalledTimes(2);
  expect(mockInsert.mock.calls[0][0][0].session_id).toBe(mockInsert.mock.calls[1][0][0].session_id);
  expect(JSON.parse(localStorage.getItem('sessionLog'))).toHaveLength(1);
  fireEvent.click(screen.getAllByRole('button', { name: 'Return Home' })[0]);
  fireEvent.click(screen.getByRole('button', { name: /Breathing RESET/i }));
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  rateBefore();
  expect(screen.getByRole('button', { name: 'Continue RESET' })).toBeInTheDocument();
});

test('standalone acupressure gathers fresh ratings, runs its timer, and saves an independent typed session', async () => {
  jest.useFakeTimers();
  try {
    localStorage.setItem('sessionLog', JSON.stringify([{ id: 'old', beforeScore: 9, afterScore: 8 }]));
    render(<App environment="test-review" />);
    await settleAppEffects();
    fireEvent.click(screen.getByRole('button', { name: /Acupressure RESET/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Mind Calm' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    rateBefore();
    fireEvent.click(screen.getByRole('button', { name: 'Start', exact: true }));
    act(() => jest.advanceTimersByTime(60000));
    fireEvent.click(screen.getByRole('button', { name: 'Finish & Rate' }));
    expect(mockInsert).not.toHaveBeenCalled();
    await rateAfter();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({ intervention_type: 'acupressure_reset', craving_before: 6, craving_after: 3, stress_before: 5, stress_after: 2 })]);
    expect(JSON.parse(localStorage.getItem('sessionLog'))).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Mind Calm Result' })).toBeInTheDocument();
  } finally { jest.useRealTimers(); }
});

test.each(['grounding', 'acupressure'])('%s exit does not save and reentry starts with fresh ratings', async (type) => {
  render(<App environment="test-review" />);
  await settleAppEffects();
  const enter = () => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${type} RESET`, 'i') }));
    if (type === 'acupressure') fireEvent.click(screen.getByRole('button', { name: 'Start Mind Calm' }));
  };
  enter();
  rateBefore();
  if (type === 'acupressure') fireEvent.click(screen.getByRole('button', { name: 'Start', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: type === 'acupressure' ? 'Exit Without Saving' : 'Exit Exercise' }));
  expect(mockInsert).not.toHaveBeenCalled();
  if (type === 'acupressure') fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  enter();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
});

test.each(['grounding', 'acupressure'])('%s uses fresh entitlement checks and cannot start with expired access', async (type) => {
  const refreshEntitlement = jest.fn().mockResolvedValue({ hasAccess: false });
  const onAccessDenied = jest.fn();
  render(<App currentUser={{ id: 'user-a' }} refreshEntitlement={refreshEntitlement} onAccessDenied={onAccessDenied} />);
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${type} RESET`, 'i') }));
  if (type === 'acupressure') fireEvent.click(screen.getByRole('button', { name: 'Start Mind Calm' }));
  await waitFor(() => expect(onAccessDenied).toHaveBeenCalledWith({ hasAccess: false }));
  expect(refreshEntitlement).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('heading', { name: 'How strong is the craving?' })).not.toBeInTheDocument();
  expect(mockInsert).not.toHaveBeenCalled();
});

test('breathing preserves optional Channel Energy and its saved action', async () => {
  render(<App environment="test-review" />);
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: /Breathing RESET/i }));
  rateBefore();
  fireEvent.click(screen.getByRole('button', { name: 'Continue RESET' }));
  fireEvent.click(screen.getByRole('button', { name: /Channel Energy/i }));
  fireEvent.click(screen.getByRole('button', { name: '10-min fast walk' }));
  await rateAfter();
  expect(screen.getByText('10-min fast walk')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('sessionLog'))[0]).toMatchObject({ interventionType: 'craving_reset', selectedAction: '10-min fast walk' });
});

test('anxiety average includes all three RESET types and historical records without duplicating sessions', () => {
  expect(calculateAverageAnxietyReduction([
    { id: 'a', interventionType: 'craving_reset', anxietyBefore: 8, anxietyAfter: 2 },
    { id: 'b', interventionType: 'acupressure_reset', anxietyBefore: 7, anxietyAfter: 3 },
    { id: 'c', interventionType: 'grounding_reset', anxietyBefore: 2, anxietyAfter: 4 },
    { id: 'd', anxietyBefore: 4, anxietyAfter: 4 },
    { id: 'b', interventionType: 'acupressure_reset', anxietyBefore: 7, anxietyAfter: 3 }
  ])).toBe('2.0');
});

test('dashboard filter preserves historical sessions and applies to craving, stress, engagement and mood aggregates', async () => {
  const rows = [
    { intervention_type: 'craving_reset', craving_before: 8, craving_after: 2, stress_before: 7, stress_after: 2, stress_level: 2 },
    { intervention_type: 'acupressure_reset', craving_before: 6, craving_after: 3, stress_before: 6, stress_after: 3, stress_level: 3 },
    { intervention_type: 'grounding_reset', craving_before: 9, craving_after: 7, stress_before: 8, stress_after: 7, stress_level: 7 },
    { craving_before: 4, craving_after: 4, stress_level: 4 }
  ].map((row, index) => ({ ...row, session_id: `s-${index}`, device_id: `d-${index}`, mood: 'Low', created_at: new Date().toISOString() }));
  mockSelect.mockReturnValue({ order: async () => ({ data: rows, error: null }) });
  render(<App environment="development" />);
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: 'Administrator' }));
  fireEvent.click(screen.getByRole('button', { name: /Analytics/i }));
  const metric = (label) => screen.getByText((_, element) =>
    within(element).queryByRole('heading', { name: label, exact: true }) !== null,
    { selector: '.analytics-metric-card' });
  await waitFor(() => expect(metric('RESET Sessions Completed')).toHaveTextContent('4'));
  expect(metric('Average User Craving Change')).toHaveTextContent('2.8');
  expect(metric('Average Stress Level')).toHaveTextContent('4.0/10');
  expect(metric('Users Showing Craving Improvement')).toHaveTextContent('75%');
  for (const [type, count, change, stress] of [
    ['craving_reset', '2', '3.0', '3.0/10'],
    ['acupressure_reset', '1', '3.0', '3.0/10'],
    ['grounding_reset', '1', '2.0', '7.0/10']
  ]) {
    fireEvent.change(screen.getByRole('combobox', { name: 'Intervention' }), { target: { value: type } });
    expect(metric('RESET Sessions Completed')).toHaveTextContent(count);
    expect(metric('Average User Craving Change')).toHaveTextContent(change);
    expect(metric('Average Stress Level')).toHaveTextContent(stress);
    expect(metric('Low Mood')).toHaveTextContent(`Sessions${count}`);
  }
  fireEvent.change(screen.getByRole('combobox', { name: 'Intervention' }), { target: { value: 'all' } });
  expect(metric('RESET Sessions Completed')).toHaveTextContent('4');
});

test('early acupressure saves actual ratings and partial metadata locally and in the proposed cloud payload', async () => {
  crypto.randomUUID.mockReturnValueOnce('early-acupressure').mockReturnValueOnce('test-device').mockReturnValue('next-breathing');
  jest.useFakeTimers();
  try {
    render(<App environment="test-review" />);
    await settleAppEffects();
    fireEvent.click(screen.getByRole('button', { name: /Acupressure RESET/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Wrist Calm' }));
    rateBefore();
    fireEvent.click(screen.getByRole('button', { name: 'Start', exact: true }));
    act(() => jest.advanceTimersByTime(2500));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => jest.advanceTimersByTime(10000));
    fireEvent.click(screen.getByRole('button', { name: 'Finish & Rate' }));
    expect(mockInsert).not.toHaveBeenCalled();
    await rateAfter();
    expect(JSON.parse(localStorage.getItem('sessionLog'))[0]).toMatchObject({ interventionType: 'acupressure_reset', beforeScore: 6, afterScore: 3, anxietyBefore: 5, anxietyAfter: 2, activeDurationSeconds: 2.5, guidedSequenceCompleted: false });
    expect(screen.getByText('Finished before the full guided sequence')).toBeInTheDocument();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const payload = mockInsert.mock.calls[0][0][0];
    expect(payload).toMatchObject({ intervention_type: 'acupressure_reset', craving_before: 6, craving_after: 3, stress_before: 5, stress_after: 2 });
    expect(payload.active_duration_seconds).toBe(2.5);
    expect(payload.guided_sequence_completed).toBe(false);
    fireEvent.click(screen.getAllByRole('button', { name: 'Return Home' })[0]);
    await completeResetFlow();
    expect(screen.queryByText('Finished before the full guided sequence')).not.toBeInTheDocument();
  } finally { jest.useRealTimers(); }
});

test('production without authentication cannot save through the legacy fallback', async () => {
  render(<App environment="production" />);
  await settleAppEffects();
  await completeResetFlow();
  expect(mockInsert).not.toHaveBeenCalled();
  expect(screen.getByText('Sign in before saving a RESET session.')).toBeInTheDocument();
});

test('expired authentication keeps completed measurements in the original account cache', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  render(<App environment="production" currentUser={{ id: 'user-owned-uuid' }} />);
  await settleAppEffects();
  await completeResetFlow();
  expect(mockInsert).not.toHaveBeenCalled();
  const cached = JSON.parse(localStorage.getItem('pulsewell:reset-history:v2:user:user-owned-uuid')).sessions[0];
  expect(cached).toMatchObject({ ownerUserId: 'user-owned-uuid', syncStatus: 'failed' });
  expect(cached.beforeScore).toEqual(expect.any(Number));
  expect(cached.afterScore).toEqual(expect.any(Number));
  expect(localStorage.getItem('sessionLog')).toBeNull();
});

test('switching accounts mid-exercise retains completed measurements under the starting owner', async () => {
  const { rerender } = render(<App environment="production" currentUser={{ id: 'user-owned-uuid' }} />);
  await settleAppEffects();
  await advanceToPostResetAnxiety();
  rerender(<App environment="production" currentUser={{ id: 'user-b' }} />);
  await settleAppEffects();
  fireEvent.click(screen.getByRole('button', { name: '2' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByText('Your RESET was saved on this device, but cloud sync failed.')).toBeInTheDocument();
  expect(mockInsert).not.toHaveBeenCalled();
  const a = JSON.parse(localStorage.getItem('pulsewell:reset-history:v2:user:user-owned-uuid')).sessions;
  expect(a[0]).toMatchObject({ ownerUserId: 'user-owned-uuid', anxietyAfter: 2, syncStatus: 'pending' });
  const b = JSON.parse(localStorage.getItem('pulsewell:reset-history:v2:user:user-b'));
  expect(b?.sessions || []).toEqual([]);
});
