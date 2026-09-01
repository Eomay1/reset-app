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
    rpc: jest.fn()
  }
}));

const userA = { id: "user-a-uuid", email: "a@example.com" };
const userB = { id: "user-b-uuid", email: "b@example.com" };
let authListener;

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
  supabase.rpc.mockReset().mockResolvedValue({ data: { user_id: userA.id }, error: null });
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
