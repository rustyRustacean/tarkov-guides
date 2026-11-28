import { describe, expect, it } from "vitest";

import { collectCitations, formatSourceDate, timestampSeconds, youtubeAt } from "./guide-citations";

describe("collectCitations", () => {
  it("numbers sources in order of first use", () => {
    const body = [
      'Bots see you. <Cite id="b" t="1:00" />',
      'Bullets drop. <Cite id="a" />',
      'Bots again. <Cite id="b" t="2:30" />',
    ].join("\n");

    expect(collectCitations(body)).toEqual([
      { id: "b", number: 1, timestamps: ["1:00", "2:30"] },
      { id: "a", number: 2, timestamps: [] },
    ]);
  });

  it("lists each timestamp once, in video order rather than citation order", () => {
    const body =
      '<Cite id="a" t="3:56" /> <Cite id="a" t="0:05" /> <Cite id="a" t="3:56" /> <Cite id="a" t="10:00" />';
    expect(collectCitations(body)).toEqual([
      { id: "a", number: 1, timestamps: ["0:05", "3:56", "10:00"] },
    ]);
  });

  it("returns nothing for a body without citations", () => {
    expect(collectCitations("Just prose, no sources.")).toEqual([]);
  });

  it("accepts hour-long timestamps", () => {
    expect(collectCitations('<Cite id="a" t="1:02:03" />')[0]?.timestamps).toEqual(["1:02:03"]);
  });
});

describe("timestampSeconds", () => {
  it("converts m:ss and h:mm:ss to whole seconds", () => {
    expect(timestampSeconds("0:00")).toBe(0);
    expect(timestampSeconds("3:12")).toBe(192);
    expect(timestampSeconds("12:44")).toBe(764);
    expect(timestampSeconds("1:02:03")).toBe(3723);
  });
});

describe("youtubeAt", () => {
  it("adds a start time to a watch URL", () => {
    expect(youtubeAt("https://www.youtube.com/watch?v=abc", "3:12")).toBe(
      "https://www.youtube.com/watch?v=abc&t=192s",
    );
  });
});

describe("formatSourceDate", () => {
  it("formats an ISO date as day, short month and year, independent of the time zone", () => {
    expect(formatSourceDate("2026-11-10")).toBe("10 Nov 2026");
    expect(formatSourceDate("2025-01-01")).toBe("1 Jan 2025");
    expect(formatSourceDate("2025-09-15")).toBe("15 Sep 2025");
  });
});
