import { describe, expect, it } from "vitest";
import { getSketchImageValidationError } from "./sketchFile";

describe("getSketchImageValidationError", () => {
  it("accepts PNG and JPEG sketches", () => {
    expect(getSketchImageValidationError(new File(["png"], "ramp.png", { type: "image/png" }))).toBeNull();
    expect(getSketchImageValidationError(new File(["jpeg"], "ramp.jpg", { type: "image/jpeg" }))).toBeNull();
  });

  it("rejects image formats the preview does not promise to support", () => {
    expect(getSketchImageValidationError(new File(["heic"], "ramp.heic", { type: "image/heic" })))
      .toBe("Upload a PNG or JPEG image of your physics sketch.");
  });
});
