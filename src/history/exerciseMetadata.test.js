import { mergeExerciseMetadata, normalizeActiveDuration, normalizeGuidedCompletion } from './exerciseMetadata';

test('missing historical metadata remains unknown, not zero or false', () => {
  expect(normalizeActiveDuration(undefined)).toBeNull();
  expect(normalizeGuidedCompletion(undefined)).toBeNull();
  expect(mergeExerciseMetadata({}, {})).toEqual({
    activeDurationSeconds: null, activeDurationSource: null,
    guidedSequenceCompleted: null, guidedSequenceSource: null
  });
});

test('cloud zero and false override conflicting local metadata', () => {
  expect(mergeExerciseMetadata(
    { activeDurationSeconds: 60, guidedSequenceCompleted: true },
    { activeDurationSeconds: 0, guidedSequenceCompleted: false }
  )).toEqual({ activeDurationSeconds: 0, activeDurationSource: 'cloud', guidedSequenceCompleted: false, guidedSequenceSource: 'cloud' });
});

test('cloud null preserves measured local metadata without claiming cloud storage', () => {
  expect(mergeExerciseMetadata(
    { activeDurationSeconds: 0, guidedSequenceCompleted: false },
    { activeDurationSeconds: null, guidedSequenceCompleted: null }
  )).toEqual({ activeDurationSeconds: 0, activeDurationSource: 'device', guidedSequenceCompleted: false, guidedSequenceSource: 'device' });
});

test.each([-1, Infinity, -Infinity, NaN, '12', true])('invalid duration %s is rejected', value => {
  expect(() => normalizeActiveDuration(value)).toThrow(/finite, nonnegative/);
});

test.each([0, 1, 'false', 'true', {}])('nonboolean protocol completion %s is rejected', value => {
  expect(() => normalizeGuidedCompletion(value)).toThrow(/boolean/);
});
