import io
from PIL import Image


class ImageError(ValueError):
    """Raised when image validation or normalization fails."""
    pass


MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_LONGEST_SIDE_PX = 2048


def normalize_image(image_bytes: bytes) -> bytes:
    """
    Accept only JPEG/PNG verified by Pillow, max 5 MB, max 2048 px longest side.
    Re-encode to JPEG to drop metadata. Raise ImageError on anything else.
    """
    if not isinstance(image_bytes, (bytes, bytearray)):
        raise ImageError("Input must be bytes")

    if len(image_bytes) == 0:
        raise ImageError("Empty image bytes")

    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise ImageError(f"Image size {len(image_bytes)} bytes exceeds maximum allowed 5 MB")

    try:
        with Image.open(io.BytesIO(image_bytes)) as probe:
            fmt = probe.format
            if fmt not in ("JPEG", "PNG"):
                raise ImageError(f"Unsupported image format: {fmt}. Only JPEG and PNG are allowed.")
            probe.verify()
    except ImageError:
        raise
    except Exception as e:
        raise ImageError(f"Corrupt or invalid image: {e}") from e

    try:
        # Re-open for actual processing and re-encoding
        with Image.open(io.BytesIO(image_bytes)) as img:
            # Drop alpha / palette and convert to RGB
            if img.mode != "RGB":
                img = img.convert("RGB")

            width, height = img.size
            max_side = max(width, height)
            if max_side > MAX_LONGEST_SIDE_PX:
                scale = MAX_LONGEST_SIDE_PX / float(max_side)
                new_w = max(1, int(round(width * scale)))
                new_h = max(1, int(round(height * scale)))
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

            output = io.BytesIO()
            # Saving freshly without exif/info drops all metadata
            img.save(output, format="JPEG", quality=85)
            return output.getvalue()
    except Exception as e:
        raise ImageError(f"Failed to normalize image: {e}") from e
