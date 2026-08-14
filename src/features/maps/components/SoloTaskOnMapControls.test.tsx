import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useSoloTaskStore } from "../solo-task-store";

import { SoloTaskOnMapControls } from "./SoloTaskOnMapControls";

beforeEach(() => {
  useSoloTaskStore.setState({ soloTaskId: null });
});

describe("SoloTaskOnMapControls", () => {
  it("solos the task it was given", async () => {
    render(<SoloTaskOnMapControls taskId="task-a" />);
    await userEvent.click(screen.getByRole("button", { name: /show only this task/i }));
    expect(useSoloTaskStore.getState().soloTaskId).toBe("task-a");
  });

  it("is exclusive - soloing another task replaces the first", async () => {
    useSoloTaskStore.setState({ soloTaskId: "task-a" });
    render(<SoloTaskOnMapControls taskId="task-b" />);
    await userEvent.click(screen.getByRole("button", { name: /show only this task/i }));
    expect(useSoloTaskStore.getState().soloTaskId).toBe("task-b");
  });

  it("shows no clear button until something is soloed", () => {
    const { rerender } = render(<SoloTaskOnMapControls taskId="task-a" />);
    expect(screen.queryByRole("button", { name: "Show all tasks" })).not.toBeInTheDocument();

    useSoloTaskStore.setState({ soloTaskId: "task-a" });
    rerender(<SoloTaskOnMapControls taskId="task-a" />);
    expect(screen.getByRole("button", { name: "Show all tasks" })).toBeInTheDocument();
  });

  it("the clear button un-solos, whichever task's popup it is clicked from", async () => {
    useSoloTaskStore.setState({ soloTaskId: "task-a" });
    render(<SoloTaskOnMapControls taskId="task-b" />);

    expect(screen.getByText(/another task is currently the only one/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show all tasks" }));
    expect(useSoloTaskStore.getState().soloTaskId).toBeNull();
  });

  it("marks the button as pressed for the task that is currently soloed", () => {
    useSoloTaskStore.setState({ soloTaskId: "task-a" });
    render(<SoloTaskOnMapControls taskId="task-a" />);
    expect(screen.getByRole("button", { name: /only this task is shown/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
