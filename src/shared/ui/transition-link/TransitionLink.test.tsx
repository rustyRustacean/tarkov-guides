import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TransitionLink } from "./TransitionLink";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("TransitionLink", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("navigates via router.push on a plain click", async () => {
    const user = userEvent.setup();
    render(<TransitionLink href="/somewhere">Go</TransitionLink>);

    await user.click(screen.getByRole("link", { name: "Go" }));

    expect(push).toHaveBeenCalledWith("/somewhere");
  });

  it("leaves modifier-key clicks to the browser's default behavior", () => {
    render(<TransitionLink href="/somewhere">Go</TransitionLink>);

    fireEvent.click(screen.getByRole("link", { name: "Go" }), { metaKey: true });

    expect(push).not.toHaveBeenCalled();
  });

  it("still calls a passed onClick handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <TransitionLink href="/somewhere" onClick={onClick}>
        Go
      </TransitionLink>,
    );

    await user.click(screen.getByRole("link", { name: "Go" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
