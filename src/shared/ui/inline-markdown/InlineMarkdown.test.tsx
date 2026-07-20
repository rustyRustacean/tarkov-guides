import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InlineMarkdown } from "./InlineMarkdown";

describe("InlineMarkdown", () => {
  it("renders plain text with no markers unchanged", () => {
    render(<InlineMarkdown text="A brief explanation." />);
    expect(screen.getByText("A brief explanation.")).toBeInTheDocument();
  });

  it("renders **bold** spans as <strong> without the asterisks", () => {
    render(<InlineMarkdown text="Prioritize **right-hand angles** over left-hand ones." />);
    const strong = screen.getByText("right-hand angles");
    expect(strong.tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it("supports multiple bold spans in one string", () => {
    render(<InlineMarkdown text="**First** and **second** are both bold." />);
    expect(screen.getByText("First").tagName).toBe("STRONG");
    expect(screen.getByText("second").tagName).toBe("STRONG");
  });

  it("renders [text](href) as a real link without the markdown syntax", () => {
    render(<InlineMarkdown text="See the [Baiting](#baiting) chapter." />);
    const link = screen.getByRole("link", { name: "Baiting" });
    expect(link).toHaveAttribute("href", "#baiting");
    expect(screen.queryByText(/[[\]]/)).not.toBeInTheDocument();
  });

  it("supports bold and links together in one string", () => {
    render(
      <InlineMarkdown text="Lean on the [Gathering Intel](#gathering-intel) chapter and **stay unpredictable**." />,
    );
    expect(screen.getByRole("link", { name: "Gathering Intel" })).toHaveAttribute(
      "href",
      "#gathering-intel",
    );
    expect(screen.getByText("stay unpredictable").tagName).toBe("STRONG");
  });
});
