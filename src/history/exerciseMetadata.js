export function normalizeActiveDuration(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError("active_duration_seconds must be a finite, nonnegative number or null.");
  }
  return value;
}

export function normalizeGuidedCompletion(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "boolean") {
    throw new TypeError("guided_sequence_completed must be a boolean or null.");
  }
  return value;
}

// Null cloud fields must not erase genuinely measured device-only metadata.
// In particular, 0 and false are authoritative values, not missing values.
export function mergeExerciseMetadata(local = {}, cloud = {}) {
  const duration = normalizeActiveDuration(cloud.activeDurationSeconds);
  const completion = normalizeGuidedCompletion(cloud.guidedSequenceCompleted);
  const localDuration = normalizeActiveDuration(local.activeDurationSeconds);
  const localCompletion = normalizeGuidedCompletion(local.guidedSequenceCompleted);
  return {
    activeDurationSeconds: duration ?? localDuration,
    activeDurationSource: duration !== null ? "cloud" : localDuration !== null ? "device" : null,
    guidedSequenceCompleted: completion ?? localCompletion,
    guidedSequenceSource: completion !== null ? "cloud" : localCompletion !== null ? "device" : null
  };
}
