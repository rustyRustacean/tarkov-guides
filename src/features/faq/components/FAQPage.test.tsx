import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FAQPage } from "./FAQPage";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("FAQPage", () => {
  it("renders every question collapsed", () => {
    render(<FAQPage />);

    expect(screen.getByRole("heading", { name: "Frequently Asked Questions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Is this site safe to use/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /How can I support this site/ })).toBeInTheDocument();
  });

  it("orders 'Is this site safe' first and 'How can I support' last", () => {
    render(<FAQPage />);

    const questions = screen.getAllByRole("button").map((button) => button.textContent);
    expect(questions[0]).toMatch(/Is this site safe to use/);
    expect(questions[questions.length - 1]).toMatch(/How can I support this site/);
  });

  it("expands the safety answer on click", async () => {
    const user = userEvent.setup();
    render(<FAQPage />);

    await user.click(screen.getByRole("button", { name: /Is this site safe to use/ }));
    expect(screen.getByText(/other commonly-used Tarkov companion sites/)).toBeInTheDocument();
  });

  it("expands the support answer to show the tip jar link", async () => {
    const user = userEvent.setup();
    render(<FAQPage />);

    await user.click(screen.getByRole("button", { name: /How can I support this site/ }));
    expect(screen.getByRole("link", { name: /Open Tip Jar/ })).toHaveAttribute(
      "href",
      "https://ko-fi.com/tarkovguides",
    );
  });
});
