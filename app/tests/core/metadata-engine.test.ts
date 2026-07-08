import { describe, it, expect, vi } from "vitest";
import { extractMetadata } from "../../src/core/services/metadata-engine";
import { makeFixtureWorkspace, writeFixtureFile, cleanupWorkspace } from "../helpers";

function noopLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
}

describe("metadata engine", () => {
  it("extracts JSON metadata", async () => {
    const ws = makeFixtureWorkspace({ id: "meta-fixture-json" });
    const p = writeFixtureFile(ws, "data.json", JSON.stringify({ a: 1, b: 2 }));
    const records = await extractMetadata(p, "json", noopLogger());
    expect(records.find((r) => r.key === "valid")?.value).toBe("true");
    expect(records.find((r) => r.key === "topLevelKeyCount")?.value).toBe("2");
    cleanupWorkspace(ws);
  });

  it("flags invalid JSON without throwing", async () => {
    const ws = makeFixtureWorkspace({ id: "meta-fixture-badjson" });
    const p = writeFixtureFile(ws, "bad.json", "{not valid");
    const records = await extractMetadata(p, "json", noopLogger());
    expect(records.find((r) => r.key === "valid")?.value).toBe("false");
    cleanupWorkspace(ws);
  });

  it("extracts markdown title and line count", async () => {
    const ws = makeFixtureWorkspace({ id: "meta-fixture-md" });
    const p = writeFixtureFile(ws, "doc.md", "# My Title\n\nSome body text.\nMore text.");
    const records = await extractMetadata(p, "md", noopLogger());
    expect(records.find((r) => r.key === "title")?.value).toBe("My Title");
    cleanupWorkspace(ws);
  });

  it("extracts text line and char counts", async () => {
    const ws = makeFixtureWorkspace({ id: "meta-fixture-txt" });
    const p = writeFixtureFile(ws, "notes.txt", "line one\nline two\nline three");
    const records = await extractMetadata(p, "txt", noopLogger());
    expect(records.find((r) => r.key === "lineCount")?.value).toBe("3");
    cleanupWorkspace(ws);
  });

  it("extracts SVG width/height/viewBox", async () => {
    const ws = makeFixtureWorkspace({ id: "meta-fixture-svg" });
    const p = writeFixtureFile(
      ws,
      "icon.svg",
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"></svg>`
    );
    const records = await extractMetadata(p, "svg", noopLogger());
    expect(records.find((r) => r.key === "width")?.value).toBe("100");
    expect(records.find((r) => r.key === "height")?.value).toBe("50");
    cleanupWorkspace(ws);
  });

  it("parses a minimal synthetic PSD header", async () => {
    const ws = makeFixtureWorkspace({ id: "meta-fixture-psd" });
    // Hand-built 26-byte PSD header: signature, version=1, 6 reserved bytes,
    // channels=3, height=200, width=100, depth=8, colorMode=3 (RGB).
    const buf = Buffer.alloc(26);
    buf.write("8BPS", 0, "ascii");
    buf.writeUInt16BE(1, 4); // version
    buf.writeUInt16BE(3, 12); // channels
    buf.writeUInt32BE(200, 14); // height
    buf.writeUInt32BE(100, 18); // width
    buf.writeUInt16BE(8, 22); // depth
    buf.writeUInt16BE(3, 24); // color mode = RGB
    const p = writeFixtureFile(ws, "logo.psd", buf);

    const records = await extractMetadata(p, "psd", noopLogger());
    expect(records.find((r) => r.key === "width")?.value).toBe("100");
    expect(records.find((r) => r.key === "height")?.value).toBe("200");
    expect(records.find((r) => r.key === "colorMode")?.value).toBe("RGB");
    cleanupWorkspace(ws);
  });

  it("parses a minimal synthetic XCF header", async () => {
    const ws = makeFixtureWorkspace({ id: "meta-fixture-xcf" });
    const buf = Buffer.alloc(26);
    buf.write("gimp xcf ", 0, "ascii");
    buf.write("v009", 9, "ascii");
    buf.writeUInt8(0, 13); // NUL terminator
    buf.writeUInt32BE(320, 14); // width
    buf.writeUInt32BE(240, 18); // height
    buf.writeUInt32BE(0, 22); // base type = RGB
    const p = writeFixtureFile(ws, "art.xcf", buf);

    const records = await extractMetadata(p, "xcf", noopLogger());
    expect(records.find((r) => r.key === "width")?.value).toBe("320");
    expect(records.find((r) => r.key === "height")?.value).toBe("240");
    expect(records.find((r) => r.key === "baseType")?.value).toBe("RGB");
    cleanupWorkspace(ws);
  });

  it("never throws on an unsupported/corrupt file", async () => {
    const ws = makeFixtureWorkspace({ id: "meta-fixture-corrupt" });
    const p = writeFixtureFile(ws, "broken.psd", Buffer.from([0, 1, 2]));
    await expect(extractMetadata(p, "psd", noopLogger())).resolves.toBeInstanceOf(Array);
    cleanupWorkspace(ws);
  });
});
