import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HistoryPage from './HistoryPage';
import useAuthenticatedResetHistory from '../history/useAuthenticatedResetHistory';

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }));
jest.mock('../history/useAuthenticatedResetHistory');

test('history labels all interventions and keeps incomplete historical ratings readable', () => {
  useAuthenticatedResetHistory.mockReturnValue({ sessions: [
    { id: '1', interventionType: 'craving_reset', beforeScore: 7, afterScore: 2, anxietyBefore: 6, anxietyAfter: 3 },
    { id: '2', interventionType: 'acupressure_reset', beforeScore: 8, afterScore: 3 },
    { id: '3', interventionType: 'grounding_reset', beforeScore: 4, afterScore: 4 },
    { id: '4' }
  ], loading: false });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HistoryPage /></MemoryRouter>);
  for (const label of ['Breathing RESET', 'Acupressure RESET', 'Grounding RESET', 'Historical RESET']) expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText('Craving: 7 → 2')).toBeInTheDocument();
  expect(screen.getByText('Anxiety: 6 → 3')).toBeInTheDocument();
  expect(screen.getByText('Craving: — → —')).toBeInTheDocument();
});

test('history distinguishes cloud metadata from device-only metadata and preserves zero/false', () => {
  useAuthenticatedResetHistory.mockReturnValue({ sessions: [
    { id: 'cloud', activeDurationSeconds: 0, activeDurationSource: 'cloud', guidedSequenceCompleted: false, guidedSequenceSource: 'cloud', syncStatus: 'synced' },
    { id: 'local', activeDurationSeconds: 12, activeDurationSource: 'device', guidedSequenceCompleted: true, guidedSequenceSource: 'device', syncStatus: 'synced' },
    { id: 'legacy', activeDurationSeconds: null, guidedSequenceCompleted: null }
  ], loading: false });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HistoryPage /></MemoryRouter>);
  expect(screen.getByText('Active exercise time: 0 seconds (synced)')).toBeInTheDocument();
  expect(screen.getByText('Finished before the full guided sequence (synced)')).toBeInTheDocument();
  expect(screen.getByText('Active exercise time: 12 seconds (this device only)')).toBeInTheDocument();
  expect(screen.getByText('Full guided sequence completed (this device only)')).toBeInTheDocument();
  expect(screen.getAllByText(/Active exercise time:/)).toHaveLength(2);
});

test('history offers a retry for pending records and preserves an actionable authentication error', async () => {
  const retrySession = jest.fn().mockRejectedValue(new Error('Authentication expired'));
  useAuthenticatedResetHistory.mockReturnValue({ sessions: [{ id: 'owned', sessionId: 'owned', syncStatus: 'failed', beforeScore: 8, afterScore: 3 }], loading: false, retrySession });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><HistoryPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('original user'));
  expect(retrySession).toHaveBeenCalledWith('owned');
  expect(screen.getByText('Craving: 8 → 3')).toBeInTheDocument();
  retrySession.mockResolvedValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(retrySession).toHaveBeenCalledTimes(2);
});
