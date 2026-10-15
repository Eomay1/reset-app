export const INTERVENTIONS = [
  { type: "craving_reset", label: "Breathing RESET" },
  { type: "acupressure_reset", label: "Acupressure RESET" },
  { type: "grounding_reset", label: "Grounding RESET" }
];

// Missing types predate intervention selection. Preserve unknown historical types.
export function interventionType(value) {
  return value || "craving_reset";
}

export function interventionLabel(value) {
  if (!value) return "Historical RESET";
  return INTERVENTIONS.find((item) => item.type === value)?.label || `Historical RESET (${value})`;
}

export function filterInterventions(sessions, type) {
  return type === "all" ? sessions : sessions.filter((session) =>
    interventionType(session.intervention_type ?? session.interventionType) === type
  );
}
