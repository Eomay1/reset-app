import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AppRouter from "./AppRouter";
import { AuthProvider } from "./auth/AuthProvider";
import { supabase } from "./supabaseClient";

jest.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      signOut: jest.fn()
    },
    rpc: jest.fn(),
    from: jest.fn()
  }
}));

const userA = { id: "user-a-uuid", email: "a@example.com" };
const userB = { id: "user-b-uuid", email: "b@example.com" };
let authListener;

const entitlementRow = (overrides = {}) => ({
  user_id: userA.id,
  trial_started_at: "2026-09-01T00:00:00Z",
  trial_ends_at: "2026-09-08T00:00:00Z",
  entitlement_status: "trial",
  effective_status: "active_trial",
  has_access: true,
  server_now: "2026-09-03T00:00:00Z",
  ...overrides
});

function ResetStub({ currentUser }) {
  return <main><h1>Protected RESET</h1><p>{currentUser.email}</p></main>;
}

function renderRouter(path = "/start") {
  window.history.pushState({}, "", path);
  return render(<AuthProvider><AppRouter ResetApp={ResetStub} /></AuthProvider>);
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  authListener = null;
  supabase.auth.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  supabase.auth.onAuthStateChange.mockReset().mockImplementation((listener) => {
    authListener = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  supabase.auth.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  supabase.auth.verifyOtp.mockReset();
  supabase.auth.signOut.mockReset().mockResolvedValue({ error: null });
  supabase.rpc.mockReset().mockImplementation((name) => {
    if (name === "ensure_consumer_account") {
      return Promise.resolve({ data: { user_id: userA.id }, error: null });
    }
    return Promise.resolve({ data: [entitlementRow()], error: null });
  });
  supabase.from.mockReset().mockReturnValue({
    select: () => ({
      eq: () => ({
        order: () => ({ range: async () => ({ data: [], error: null }) })
      })
    })
  });
});

test("signed-out users cannot access /app and /start loads", async () => {
  renderRouter("/app");
  expect(await screen.findByRole("heading", { name: "RESET" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
  expect(screen.queryByText("Protected RESET")).not.toBeInTheDocument();
});

test("signed-out users cannot access /account", async () => {
  renderRouter("/account");
  expect(await screen.findByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
});

test("OTP request uses Supabase Auth and supports resend", async () => {
  renderRouter();
  await screen.findByRole("heading", { name: "Sign in to continue" });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "person@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));

  await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
    email: "person@example.com",
    options: { shouldCreateUser: true }
  }));
  expect(await screen.findByText(/sent a six-digit sign-in code/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
  await waitFor(() => expect(supabase.auth.signInWithOtp).toHaveBeenCalledTimes(2));
});

test("valid OTP establishes the stable user session and initializes the account", async () => {
  supabase.auth.verifyOtp.mockResolvedValue({ data: { session: { user: userA } }, error: null });
  renderRouter();
  await screen.findByRole("heading", { name: "Sign in to continue" });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: userA.email } });
  fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  await screen.findByLabelText("Six-digit code");
  fireEvent.change(screen.getByLabelText("Six-digit code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to RESET" }));

  expect(await screen.findByText("Protected RESET")).toBeInTheDocument();
  expect(screen.getByText(userA.email)).toBeInTheDocument();
  expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ email: userA.email, token: "123456", type: "email" });
  expect(supabase.rpc).toHaveBeenCalledWith("ensure_consumer_account");
});

test("restores an authenticated session before rendering /app", async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: userA } }, error: null });
  renderRouter("/app");
  expect(screen.getByRole("status")).toHaveTextContent("Restoring");
  expect(await screen.findByText("Protected RESET")).toBeInTheDocument();
  expect(screen.getByText(userA.email)).toBeInTheDocument();
});

test("invalid or expired OTP is shown safely", async () => {
  supabase.auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: new Error("Token has expired") });
  renderRouter();
  await screen.findByRole("heading", { name: "Sign in to continue" });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: userA.email } });
  fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  await screen.findByLabelText("Six-digit code");
  fireEvent.change(screen.getByLabelText("Six-digit code"), { target: { value: "000000" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to RESET" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Token has expired");
  expect(screen.queryByText("Protected RESET")).not.toBeInTheDocument();
});

test("sign-out clears identity and a returning login can safely use another account", async () => {
  localStorage.setItem("sessionLog", JSON.stringify([{ id: "legacy-local-row" }]));
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: userA } }, error: null });
  supabase.auth.verifyOtp.mockResolvedValue({ data: { session: { user: userB } }, error: null });
  renderRouter("/account");

  expect(await screen.findByText(userA.email)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
  expect(screen.queryByText(userA.email)).not.toBeInTheDocument();

  supabase.rpc.mockImplementation((name) => Promise.resolve(name === "ensure_consumer_account"
    ? { data: { user_id: userB.id }, error: null }
    : { data: [entitlementRow({ user_id: userB.id })], error: null }));

  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: userB.email } });
  fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
  await screen.findByLabelText("Six-digit code");
  fireEvent.change(screen.getByLabelText("Six-digit code"), { target: { value: "654321" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to RESET" }));

  expect(await screen.findByText(userB.email)).toBeInTheDocument();
  expect(screen.queryByText(userA.email)).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("sessionLog"))).toEqual([{ id: "legacy-local-row" }]);
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
});

test("auth state listener removes authenticated state", async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: userA } }, error: null });
  renderRouter("/app");
  expect(await screen.findByText(userA.email)).toBeInTheDocument();
  await act(async () => authListener("SIGNED_OUT", null));
  expect(await screen.findByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
});

test("active trial and subscription entitlements can enter /app", async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: userA } }, error: null });
  const first = renderRouter("/app");
  expect(await screen.findByText("Protected RESET")).toBeInTheDocument();
  first.unmount();

  supabase.rpc.mockImplementation((name) => Promise.resolve(name === "ensure_consumer_account"
    ? { data: { user_id: userA.id }, error: null }
    : { data: [entitlementRow({
      entitlement_status: "subscribed",
      effective_status: "active_subscription",
      has_access: true
    })], error: null }));
  renderRouter("/app");
  expect(await screen.findByText("Protected RESET")).toBeInTheDocument();
});

test("expired and revoked entitlements cannot enter /app", async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: userA } }, error: null });
  supabase.rpc.mockImplementation((name) => Promise.resolve(name === "ensure_consumer_account"
    ? { data: { user_id: userA.id }, error: null }
    : { data: [entitlementRow({ effective_status: "trial_expired", has_access: false })], error: null }));
  const first = renderRouter("/app");
  expect(await screen.findByRole("heading", { name: "Active RESET access has ended" })).toBeInTheDocument();
  expect(screen.queryByText("Protected RESET")).not.toBeInTheDocument();
  first.unmount();

  supabase.rpc.mockImplementation((name) => Promise.resolve(name === "ensure_consumer_account"
    ? { data: { user_id: userA.id }, error: null }
    : { data: [entitlementRow({
      entitlement_status: "revoked",
      effective_status: "access_revoked",
      has_access: false
    })], error: null }));
  renderRouter("/app");
  expect(await screen.findByRole("heading", { name: "Active RESET access has ended" })).toBeInTheDocument();
});

test("expired users retain account and history access", async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: userA } }, error: null });
  supabase.rpc.mockImplementation((name) => Promise.resolve(name === "ensure_consumer_account"
    ? { data: { user_id: userA.id }, error: null }
    : { data: [entitlementRow({ effective_status: "trial_expired", has_access: false })], error: null }));
  const account = renderRouter("/account");
  expect(await screen.findByRole("heading", { name: "Account" })).toBeInTheDocument();
  expect(screen.getByText(userA.email)).toBeInTheDocument();
  account.unmount();

  renderRouter("/history");
  expect(await screen.findByRole("heading", { name: "History" })).toBeInTheDocument();
});

test("entitlement loading and entitlement errors have distinct retryable states", async () => {
  let resolveEntitlement;
  const pendingEntitlement = new Promise((resolve) => { resolveEntitlement = resolve; });
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: userA } }, error: null });
  supabase.rpc.mockImplementation((name) => name === "ensure_consumer_account"
    ? Promise.resolve({ data: { user_id: userA.id }, error: null })
    : pendingEntitlement);
  const loadingView = renderRouter("/app");
  expect(await screen.findByText("Checking your RESET access…")).toBeInTheDocument();
  await act(async () => resolveEntitlement({ data: [entitlementRow()], error: null }));
  expect(await screen.findByText("Protected RESET")).toBeInTheDocument();
  loadingView.unmount();

  const accessError = new Error("offline");
  supabase.rpc.mockImplementation((name) => Promise.resolve(name === "ensure_consumer_account"
    ? { data: { user_id: userA.id }, error: null }
    : { data: null, error: accessError }));
  renderRouter("/app");
  expect(await screen.findByRole("heading", { name: "Unable to check access" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Active RESET access has ended" })).not.toBeInTheDocument();
  expect(screen.getByText(/still signed in/i)).toBeInTheDocument();
});

test("stale User A entitlement cannot overwrite User B entitlement", async () => {
  let resolveUserA;
  const userAEntitlement = new Promise((resolve) => { resolveUserA = resolve; });
  let entitlementCalls = 0;
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: userA } }, error: null });
  supabase.rpc.mockImplementation((name) => {
    if (name === "ensure_consumer_account") return Promise.resolve({ data: {}, error: null });
    entitlementCalls += 1;
    if (entitlementCalls === 1) return userAEntitlement;
    return Promise.resolve({ data: [entitlementRow({
      user_id: userB.id,
      entitlement_status: "subscribed",
      effective_status: "active_subscription",
      has_access: true
    })], error: null });
  });
  renderRouter("/account");
  expect(await screen.findByText(userA.email)).toBeInTheDocument();
  await act(async () => authListener("SIGNED_IN", { user: userB }));
  expect(await screen.findByText(userB.email)).toBeInTheDocument();
  expect(await screen.findByText("active subscription")).toBeInTheDocument();
  await act(async () => resolveUserA({ data: [entitlementRow()], error: null }));
  expect(screen.getByText("active subscription")).toBeInTheDocument();
  expect(screen.queryByText("active trial")).not.toBeInTheDocument();
});
