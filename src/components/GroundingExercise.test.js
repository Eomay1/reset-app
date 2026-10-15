import { fireEvent, render, screen } from "@testing-library/react";
import GroundingExercise from "./GroundingExercise";

test("counts sensory items, supports toggling and skipping, and completes only after the last step", () => {
  const onComplete = jest.fn();
  render(<GroundingExercise onComplete={onComplete} onExit={jest.fn()} />);
  expect(screen.getByRole("heading")).toHaveFocus();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  for (let index = 1; index <= 5; index++) fireEvent.click(screen.getByRole("button", { name: `Noticed item ${index}` }));
  fireEvent.click(screen.getByRole("button", { name: "Noticed item 1" }));
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Noticed item 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("heading")).toHaveTextContent("4 things you can feel");
  expect(screen.getByRole("status")).toHaveTextContent("0 of 4 noticed");
  for (const sense of ["hear", "smell", "taste"]) {
    fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
    expect(screen.getByRole("heading")).toHaveTextContent(sense);
    expect(onComplete).not.toHaveBeenCalled();
  }
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
  fireEvent.click(screen.getByRole("button", { name: "Noticed item 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test("exit does not complete the exercise", () => {
  const onComplete = jest.fn();
  const onExit = jest.fn();
  render(<GroundingExercise onComplete={onComplete} onExit={onExit} />);
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  fireEvent.click(screen.getByRole("button", { name: "Exit Exercise" }));
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(onComplete).not.toHaveBeenCalled();
});
