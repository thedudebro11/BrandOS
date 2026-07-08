import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { hashFile } from "../../src/core/services/hashing-engine/hash-engine";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

describe("hash engine", () => {
  it("computes the correct SHA-256 for a file", async () => {
    const ws = makeFixtureWorkspace({ id: "hash-fixture" });
    const content = "hello brandos";
    const filePath = writeFixtureFile(ws, "sample.txt", content);
    const expected = crypto.createHash("sha256").update(content).digest("hex");

    const actual = await hashFile(filePath);
    expect(actual).toBe(expected);
    cleanupWorkspace(ws);
  });

  it("produces different hashes for different content", async () => {
    const ws = makeFixtureWorkspace({ id: "hash-fixture-2" });
    const a = await hashFile(writeFixtureFile(ws, "a.txt", "content A"));
    const b = await hashFile(writeFixtureFile(ws, "b.txt", "content B"));
    expect(a).not.toBe(b);
    cleanupWorkspace(ws);
  });

  it("produces identical hashes for identical content (duplicate detection basis)", async () => {
    const ws = makeFixtureWorkspace({ id: "hash-fixture-3" });
    const a = await hashFile(writeFixtureFile(ws, "original.txt", "same bytes"));
    const b = await hashFile(writeFixtureFile(ws, "copy.txt", "same bytes"));
    expect(a).toBe(b);
    cleanupWorkspace(ws);
  });
});
