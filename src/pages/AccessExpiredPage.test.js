import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { createCheckoutSession, redirectToCheckout } from "../billing/checkoutRepository";
import AccessExpiredPage from "./AccessExpiredPage";

jest.mock("../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../billing/checkoutRepository", () => ({
  SUBSCRIPTION_PLANS: { MONTHLY: "monthly", ANNUAL: "annual" },
  createCheckoutSession: jest.fn(),
  redirectToCheckout: jest.fn()
}));

beforeEach(() => {
  createCheckoutSession.mockReset().mockResolvedValue("https://checkout.stripe.com/test");
  redirectToCheckout.mockReset();
  useAuth.mockReturnValue({
    entitlement: { trialEndsAt: "2026-09-08T00:00:00Z" },
    session: { access_token: "access-token" },
    refreshEntitlement: jest.fn()
  });
});

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AccessExpiredPage />
    </MemoryRouter>
  );
}

test("expired access UI preserves History and Account and offers both paid plans", () => {
  renderPage();
  expect(screen.getByRole("heading", { name: "Active RESET access has ended" })).toBeInTheDocument();
  expect(screen.getByText("CA$11.99")).toBeInTheDocument();
  expect(screen.getByText("CA$99")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View History" })).toHaveAttribute("href", "/history");
  expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
});

test.each([
  ["Subscribe monthly", "monthly"],
  ["Subscribe annually", "annual"]
])("%s starts the expected checkout", async (buttonName, plan) => {
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: buttonName }));
  await waitFor(() => expect(createCheckoutSession).toHaveBeenCalledWith(plan, "access-token"));
  expect(redirectToCheckout).toHaveBeenCalledWith("https://checkout.stripe.com/test");
});

test("checkout errors remain retryable on the expired-access page", async () => {
  createCheckoutSession.mockRejectedValue(new Error("Checkout unavailable"));
  renderPage();
  fireEvent.click(screen.getByRole("button", { name: "Subscribe monthly" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Checkout unavailable");
  expect(screen.getByRole("button", { name: "Subscribe monthly" })).toBeEnabled();
});
