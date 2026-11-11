import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { GAME_DATA_CACHE_VERSION, QUERY_CACHE_BUSTER } from "./cache-version";

/**
 * Hash of a source file's tokens: comments and whitespace are skipped by
 * TypeScript's own scanner, so a doc-comment edit doesn't change it, while
 * any change to a declaration (a field added, renamed, retyped) does.
 */
function typesFingerprint(path: string): string {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    readFileSync(path, "utf8"),
  );
  const tokens: string[] = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    tokens.push(scanner.getTokenText());
  }
  return createHash("sha256").update(tokens.join(" ")).digest("hex").slice(0, 12);
}

describe("game data cache version", () => {
  it("matches the current shape of the cached payload", () => {
    const actual = typesFingerprint(join(__dirname, "types.ts"));
    expect(
      GAME_DATA_CACHE_VERSION.typesFingerprint,
      `types.ts changed shape. Set typesFingerprint in cache-version.ts to "${actual}" so returning visitors drop their cached game data.`,
    ).toBe(actual);
  });

  it("builds the buster from the revision and the fingerprint", () => {
    expect(QUERY_CACHE_BUSTER).toBe(
      `v${String(GAME_DATA_CACHE_VERSION.revision)}-${GAME_DATA_CACHE_VERSION.typesFingerprint}`,
    );
  });
});
