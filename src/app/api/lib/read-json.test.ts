import { describe, expect, it } from "vitest";

import { readJsonObject } from "./read-json";

/** A request whose body arrives in chunks with no declared length, like a chunked upload. */
function streamedRequest(chunks: string[]): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request("https://example.com/api/event-presets", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
}

describe("readJsonObject", () => {
  it("reads a JSON object", async () => {
    expect(await readJsonObject(streamedRequest(['{"a":', "1}"]), 100)).toEqual({ a: 1 });
  });

  it("refuses a body past the limit even with no declared length", async () => {
    expect(await readJsonObject(streamedRequest(["x".repeat(60), "x".repeat(60)]), 100)).toBe(
      "too-large",
    );
  });

  it("refuses a declared length past the limit without reading", async () => {
    const request = new Request("https://example.com/api/event-presets", {
      method: "POST",
      headers: { "content-length": "5000" },
      body: "{}",
    });
    expect(await readJsonObject(request, 100)).toBe("too-large");
  });

  it("is null for malformed JSON, arrays and an empty body", async () => {
    expect(await readJsonObject(streamedRequest(["{nope"]), 100)).toBeNull();
    expect(await readJsonObject(streamedRequest(["[1,2]"]), 100)).toBeNull();
    expect(await readJsonObject(streamedRequest([]), 100)).toBeNull();
  });
});
