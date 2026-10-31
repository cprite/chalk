import { describe, expect, it } from "vitest";
import { dismissPresentationOverlay, togglePresentationOverlay } from "./presentation";

describe("presentation overlay state", () => {
  it("opens a requested overlay and closes it when requested again", () => {
    expect(togglePresentationOverlay(null, "controls")).toBe("controls");
    expect(togglePresentationOverlay("controls", "controls")).toBeNull();
  });

  it("switches directly between overlays and dismisses the active one", () => {
    expect(togglePresentationOverlay("history", "results")).toBe("results");
    expect(dismissPresentationOverlay()).toBeNull();
  });
});
