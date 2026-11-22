import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { forgetEvent } from "../lib/my-events-storage";

import { EventPage } from "./EventPage";

vi.mock("./EventEditorView", () => ({
  EventEditorView: ({ editKey }: { editKey: string }) => <p>editor with {editKey}</p>,
}));
vi.mock("./EventViewer", () => ({
  EventViewer: () => <p>viewer</p>,
}));

const CODE = "abcdefghjk";
const KEY = "K".repeat(43);

describe("EventPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", `/resources/events/${CODE}`);
  });
  afterEach(() => {
    forgetEvent(CODE);
  });

  it("shows the view-only scoreboard without an edit key", () => {
    render(<EventPage code={CODE} viewOnly={false} />);
    expect(screen.getByText("viewer")).toBeInTheDocument();
  });

  it("stores an edit link's key, strips it from the address bar, and opens the editor", async () => {
    window.history.replaceState(null, "", `/resources/events/${CODE}#edit=${KEY}`);
    render(<EventPage code={CODE} viewOnly={false} />);
    expect(await screen.findByText(`editor with ${KEY}`)).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(window.localStorage.getItem("tarkovguides.events.mine.v1")).toContain(KEY);
  });

  it("shows the viewer even with a stored key when asked to preview", async () => {
    window.history.replaceState(null, "", `/resources/events/${CODE}#edit=${KEY}`);
    render(<EventPage code={CODE} viewOnly />);
    expect(await screen.findByText("viewer")).toBeInTheDocument();
  });
});
