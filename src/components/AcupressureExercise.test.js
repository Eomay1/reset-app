import { act, fireEvent, render, screen } from '@testing-library/react';
import AcupressureExercise from './AcupressureExercise';

const props = { displayName: 'Wrist Calm', duration: 60, bilateral: true, requiresSideSwitch: true };
const click = name => fireEvent.click(screen.getByRole('button', { name }));
const advance = milliseconds => act(() => jest.advanceTimersByTime(milliseconds));
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function start(overrides = {}) {
  const onComplete = jest.fn();
  const onExit = jest.fn();
  const view = render(<AcupressureExercise {...props} onComplete={onComplete} onExit={onExit} {...overrides} />);
  click('Start');
  return { onComplete, onExit, ...view };
}

test('early finish measures partial active seconds and cannot claim a full protocol or fire twice', () => {
  const { onComplete, onExit, container } = start();
  advance(2450);
  click('Finish & Rate');
  click('Finish & Rate');
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledWith({ activeDurationSeconds: 2.45, guidedSequenceCompleted: false });
  expect(onExit).not.toHaveBeenCalled();
  expect(container).not.toContainHTML('acupressure-pulse-active');
});

test('first wrist completion offers an optional second wrist and excludes time spent deciding', () => {
  const { onComplete } = start();
  advance(60000);
  expect(screen.getByRole('button', { name: 'Continue with Opposite Wrist' })).toBeInTheDocument();
  advance(30000);
  click('Finish & Rate');
  expect(onComplete).toHaveBeenCalledWith({ activeDurationSeconds: 60, guidedSequenceCompleted: false });
});

test('both normal wrist intervals count as the full guided sequence', () => {
  const { onComplete } = start();
  advance(60000);
  advance(30000);
  click('Continue with Opposite Wrist');
  advance(60000);
  advance(30000);
  click('Finish & Rate');
  expect(onComplete).toHaveBeenCalledWith({ activeDurationSeconds: 120, guidedSequenceCompleted: true });
});

test('early finish on the second wrist remains partial', () => {
  const { onComplete } = start();
  advance(60000);
  click('Continue with Opposite Wrist');
  advance(7500);
  click('Finish & Rate');
  expect(onComplete).toHaveBeenCalledWith({ activeDurationSeconds: 67.5, guidedSequenceCompleted: false });
});

test('paused time is excluded and Finish & Rate remains available while paused', () => {
  const { onComplete, container } = start();
  advance(2250);
  click('Pause');
  expect(container).not.toContainHTML('acupressure-pulse-active');
  advance(30000);
  expect(screen.getByText('58')).toBeInTheDocument();
  click('Resume');
  advance(1250);
  click('Pause');
  advance(30000);
  click('Finish & Rate');
  expect(onComplete).toHaveBeenCalledWith({ activeDurationSeconds: 3.5, guidedSequenceCompleted: false });
});

test('restart retains measured effort but elapsed totals alone do not mark a protocol complete', () => {
  const { onComplete } = start({ bilateral: false, requiresSideSwitch: false });
  advance(40000);
  click('Restart');
  advance(40000);
  click('Finish & Rate');
  expect(onComplete).toHaveBeenCalledWith({ activeDurationSeconds: 80, guidedSequenceCompleted: false });
});

test('a normal single-point interval records full completion', () => {
  const { onComplete } = start({ bilateral: false, requiresSideSwitch: false });
  advance(60000);
  click('Finish & Rate');
  expect(onComplete).toHaveBeenCalledWith({ activeDurationSeconds: 60, guidedSequenceCompleted: true });
});

test.each(['active', 'paused', 'switch', 'complete'])('Exit Without Saving abandons the %s stage without completion', stage => {
  const { onComplete, onExit, unmount } = start();
  if (stage === 'paused') click('Pause');
  if (stage === 'switch' || stage === 'complete') advance(60000);
  if (stage === 'complete') { click('Continue with Opposite Wrist'); advance(60000); }
  click('Exit Without Saving');
  advance(120000);
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(onComplete).not.toHaveBeenCalled();
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
