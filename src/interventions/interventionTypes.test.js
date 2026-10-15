import { filterInterventions, interventionLabel } from './interventionTypes';

test('all includes unknown history, breathing includes untyped history, and labels preserve uncertainty', () => {
  const sessions = [
    { intervention_type: 'craving_reset' }, { intervention_type: 'acupressure_reset' },
    { intervention_type: 'grounding_reset' }, {}, { intervention_type: 'custom-old' }
  ];
  expect(filterInterventions(sessions, 'all')).toEqual(sessions);
  expect(filterInterventions(sessions, 'craving_reset')).toEqual([sessions[0], sessions[3]]);
  expect(filterInterventions(sessions, 'grounding_reset')).toEqual([sessions[2]]);
  expect(interventionLabel(null)).toBe('Historical RESET');
  expect(interventionLabel('custom-old')).toBe('Historical RESET (custom-old)');
});
