const MAX_SKETCH_SIZE = 5 * 1024 * 1024;
const supportedSketchTypes = new Set(["image/png", "image/jpeg"]);

export function getSketchImageValidationError(file: File): string | null {
  if (!supportedSketchTypes.has(file.type)) {
    return "Upload a PNG or JPEG image of your physics sketch.";
  }

  if (file.size > MAX_SKETCH_SIZE) {
    return "Your image is over the 5 MB limit. Choose a smaller file.";
  }

  return null;
}
