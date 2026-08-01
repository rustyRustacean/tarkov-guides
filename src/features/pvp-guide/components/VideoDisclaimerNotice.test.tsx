import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { VideoDisclaimerNotice } from "./VideoDisclaimerNotice";

describe("VideoDisclaimerNotice", () => {
  it("is collapsed by default", () => {
    render(<VideoDisclaimerNotice />);
    expect(screen.getByRole("button", { name: /videos are a work in progress/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens on click and shows the work-in-progress message, with a pointer to the footer About link", async () => {
    render(<VideoDisclaimerNotice />);
    await userEvent.click(screen.getByRole("button", { name: /videos are a work in progress/i }));

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Work in progress");
    expect(notice).toHaveTextContent(/temporary placeholders/i);
    expect(notice).toHaveTextContent(/About link in the footer/i);
    expect(screen.getByRole("button", { name: /videos are a work in progress/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("closes again on a second click", async () => {
    render(<VideoDisclaimerNotice />);
    const trigger = screen.getByRole("button", { name: /videos are a work in progress/i });
    await userEvent.click(trigger);
    await userEvent.click(trigger);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes on outside click", async () => {
    render(
      <>
        <VideoDisclaimerNotice />
        <button type="button">Outside</button>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: /videos are a work in progress/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<VideoDisclaimerNotice />);
    await userEvent.click(screen.getByRole("button", { name: /videos are a work in progress/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
