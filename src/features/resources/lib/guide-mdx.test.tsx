import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { compileGuideChapter } from "./guide-mdx";

describe("compileGuideChapter", () => {
  it("numbers inline citations to match the sources it returns", async () => {
    const { content, citations } = await compileGuideChapter(
      [
        'Bots see you. <Cite id="jbobyh-bot-vision" t="1:19" />',
        "",
        'Bodies never ricochet. <Cite id="jbobyh-hitboxes" t="1:45" />',
        "",
        'Back to bots. <Cite id="jbobyh-bot-vision" />',
      ].join("\n"),
    );
    render(content);

    expect(citations.map(({ id, number }) => [id, number])).toEqual([
      ["jbobyh-bot-vision", 1],
      ["jbobyh-hitboxes", 2],
    ]);
    expect(screen.getByRole("link", { name: "[1] Source, at 1:19" })).toHaveAttribute(
      "href",
      "#source-1",
    );
    expect(screen.getByRole("link", { name: "[2] Source, at 1:45" })).toHaveAttribute(
      "href",
      "#source-2",
    );
    expect(screen.getByRole("link", { name: "[1] Source" })).toHaveAttribute("href", "#source-1");
  });

  it("renders a registered diagram by name", async () => {
    const { content } = await compileGuideChapter("<RicochetWindowDiagram />");
    render(content);

    expect(
      screen.getByRole("img", { name: /Ricochets only happen between 10 and 47.5/ }),
    ).toBeVisible();
  });

  it("refuses a source that isn't in the registry", async () => {
    await expect(compileGuideChapter('<Cite id="nobody-nothing" />')).rejects.toThrow(
      /nobody-nothing/,
    );
  });
});
