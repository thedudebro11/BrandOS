import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../src/core/events/event-bus";

describe("event bus", () => {
  it("delivers emitted events to subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("asset.created", handler);
    bus.emit("asset.created", { workspaceId: "w1", assetId: "AST-00000001", relPath: "a.txt" });
    expect(handler).toHaveBeenCalledWith({ workspaceId: "w1", assetId: "AST-00000001", relPath: "a.txt" });
  });

  it("stops delivering after off()", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("scan.started", handler);
    bus.off("scan.started", handler);
    bus.emit("scan.started", { workspaceId: "w1", runKey: "r1", trigger: "manual" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports multiple independent listeners", () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("log", a);
    bus.on("log", b);
    bus.emit("log", { level: "info", event: "test", message: "hi" });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
