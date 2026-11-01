import { act, render, screen } from "@testing-library/react";
import TrialExpirationReminder, { trialTimeRemaining } from "./TrialExpirationReminder";

const HOUR = 3600000;
const now = Date.parse("2026-10-27T12:00:00Z");
const trial = {
  userId: "user-a",
  entitlementStatus: "trial",
  effectiveStatus: "active_trial",
  hasAccess: true,
  serverNow: new Date(now).toISOString(),
  trialEndsAt: new Date(now + 48 * HOUR).toISOString()
};

test.each([
  [48 * HOUR + 1, null],
  [48 * HOUR, "2 days"],
  [48 * HOUR - 1, "less than 48 hours"],
  [25 * HOUR, "25 hours"],
  [24 * HOUR, "1 day"],
  [24 * HOUR - 1, "less than 24 hours"],
  [HOUR, "1 hour"],
  [HOUR - 1, "less than 1 hour"],
  [1, "less than 1 hour"],
  [0, null],
  [-1, null]
])("formats the expiration boundary at %s milliseconds", (remaining, expected) => {
  expect(trialTimeRemaining({ ...trial, trialEndsAt: new Date(now + remaining).toISOString() }, now)).toBe(expected);
});

test.each([
  null,
  { ...trial, entitlementStatus: "subscribed", effectiveStatus: "active_subscription" },
  { ...trial, effectiveStatus: "trial_expired" },
  { ...trial, effectiveStatus: "developer_access" },
  { ...trial, effectiveStatus: "unavailable" },
  { ...trial, entitlementStatus: "revoked", effectiveStatus: "access_revoked" },
  { ...trial, hasAccess: false },
  { ...trial, trialEndsAt: null },
  { ...trial, trialEndsAt: "invalid" },
  { ...trial, serverNow: null }
])("hides the reminder without a valid active trial: %j", (entitlement) => {
  render(<TrialExpirationReminder entitlement={entitlement} />);
  expect(screen.queryByLabelText("Trial reminder")).not.toBeInTheDocument();
});

test("uses server time, enters the 48-hour window, and disappears at expiration", () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date("2030-01-01"));
    const { rerender, unmount } = render(<TrialExpirationReminder entitlement={{ ...trial, trialEndsAt: new Date(now + 48 * HOUR + 1000).toISOString() }} />);
    expect(screen.queryByLabelText("Trial reminder")).not.toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByLabelText("Trial reminder")).toHaveTextContent("2 days");
    rerender(<TrialExpirationReminder entitlement={{ ...trial, trialEndsAt: new Date(now + 1000).toISOString() }} />);
    expect(screen.getByLabelText("Trial reminder")).toHaveTextContent("less than 1 hour");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.queryByLabelText("Trial reminder")).not.toBeInTheDocument();
    rerender(<TrialExpirationReminder entitlement={trial} />);
    expect(screen.getByLabelText("Trial reminder")).toBeInTheDocument();
    rerender(<TrialExpirationReminder entitlement={{ ...trial, entitlementStatus: "subscribed", effectiveStatus: "active_subscription" }} />);
    expect(screen.queryByLabelText("Trial reminder")).not.toBeInTheDocument();
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test('returning to the dashboard preserves elapsed server time', () => {
  jest.useFakeTimers();
  try {
    const serverClock = { serverNow: now, started: performance.now() };
    const entitlement = { ...trial, trialEndsAt: new Date(now + HOUR).toISOString() };
    const { unmount } = render(<TrialExpirationReminder entitlement={entitlement} serverClock={serverClock} />);
    expect(screen.getByLabelText('Trial reminder')).toHaveTextContent('1 hour');
    unmount();
    act(() => jest.advanceTimersByTime(HOUR));
    render(<TrialExpirationReminder entitlement={entitlement} serverClock={serverClock} />);
    expect(screen.queryByLabelText('Trial reminder')).not.toBeInTheDocument();
  } finally { jest.useRealTimers(); }
});
