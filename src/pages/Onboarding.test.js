import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WelcomePage from "./WelcomePage";
import PreviewPage from "./PreviewPage";

function openPreview() {
  render(<MemoryRouter initialEntries={["/preview"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/start" element={<h1>Registration</h1>} />
    </Routes>
  </MemoryRouter>);
}
function startBreathing() {
  fireEvent.click(screen.getByRole("button", { name: "Start Preview" }));
  fireEvent.click(screen.getByRole("button", { name: "0" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

afterEach(() => jest.useRealTimers());

test("public welcome offers exploration, trial and returning-user links", () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><WelcomePage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "RESET" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Try a Guided Preview" })).toHaveAttribute("href", "/preview");
  expect(screen.getByRole("link", { name: "Already Have an Account? Sign In" })).toHaveAttribute("href", "/signin");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("preview can be skipped immediately", () => {
  openPreview();
  fireEvent.click(screen.getByRole("link", { name: "Start My 7-Day Free Trial" }));
  expect(screen.getByRole("heading", { name: "Registration" })).toBeInTheDocument();
});

test("preview supports zero ratings, early finish and no persistent storage", () => {
  const storage = jest.spyOn(Storage.prototype, "setItem");
  openPreview();
  startBreathing();
  fireEvent.click(screen.getByRole("button", { name: "Finish & Rate" }));
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "0" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("Stress before: 0/10 · Stress afterward: 0/10")).toBeInTheDocument();
  expect(storage).not.toHaveBeenCalled();
  storage.mockRestore();
});

test("preview pauses its clock and completes after 60 active seconds", () => {
  jest.useFakeTimers();
  openPreview();
  startBreathing();
  act(() => jest.advanceTimersByTime(5000));
  expect(screen.getByText("55 seconds remaining")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  act(() => jest.advanceTimersByTime(60000));
  expect(screen.getByText("55 seconds remaining")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  act(() => jest.advanceTimersByTime(54000));
  expect(screen.getByText("1 second remaining")).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByRole("heading", { name: "How stressed do you feel afterward?" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "How stressed do you feel afterward?" })).toHaveFocus();
  expect(jest.getTimerCount()).toBe(0);
});

test("leaving during breathing clears the timer and returns to the landing page", () => {
  jest.useFakeTimers();
  openPreview();
  startBreathing();
  fireEvent.click(screen.getByRole("link", { name: "Exit Preview & Return to Landing Page" }));
  expect(screen.getByRole("heading", { name: "RESET" })).toBeInTheDocument();
  expect(jest.getTimerCount()).toBe(0);
});

test("both ratings can be skipped and completion introduces features without unlocking routines", () => {
  openPreview();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start Preview" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip this rating" }));
  expect(screen.getByText("60 seconds remaining")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Finish & Rate" }));
  fireEvent.click(screen.getByRole("button", { name: "Skip this rating" }));
  expect(screen.getByText("Stress before: Skipped · Stress afterward: Skipped")).toBeInTheDocument();
  for (const name of ["Guided acupressure", "Craving and stress support", "Your saved progress"]) {
    expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  }
  expect(screen.getAllByRole("article")).toHaveLength(3);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  const trialLinks = screen.getAllByRole("link", { name: "Start My 7-Day Free Trial" });
  expect(trialLinks).toHaveLength(2);
  trialLinks.forEach(link => expect(link).toHaveAttribute("href", "/start?intent=trial"));
  fireEvent.click(trialLinks[1]);
  expect(screen.getByRole("heading", { name: "Registration" })).toBeInTheDocument();
});

test("registering during the exercise clears its timer", () => {
  jest.useFakeTimers();
  openPreview(); startBreathing();
  fireEvent.click(screen.getByRole("link", { name: "Start My 7-Day Free Trial" }));
  expect(screen.getByRole("heading", { name: "Registration" })).toBeInTheDocument();
  expect(jest.getTimerCount()).toBe(0);
});

test("leaving and returning resets the brief preview and discards ratings", () => {
  openPreview(); startBreathing();
  fireEvent.click(screen.getByRole("button", { name: "Finish & Rate" }));
  fireEvent.click(screen.getByRole("button", { name: "0" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("link", { name: "Exit Preview & Return to Landing Page" }));
  fireEvent.click(screen.getByRole("link", { name: "Try a Guided Preview" }));
  fireEvent.click(screen.getByRole("button", { name: "Start Preview" }));
  expect(screen.getByRole("button", { name: "0" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name: "Skip this rating" }));
  expect(screen.getByText("60 seconds remaining")).toBeInTheDocument();
});
