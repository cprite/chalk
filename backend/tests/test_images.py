import io
from PIL import Image
import pytest

from app.images import ImageError, normalize_image


def test_reject_non_image_bytes():
    with pytest.raises(ImageError):
        normalize_image(b"This is just plain text, not an image.")

    with pytest.raises(ImageError):
        normalize_image(b"\x89PNG\r\n\x1a\nCorruptedPNGData")

    with pytest.raises(ImageError):
        normalize_image(b"")


def test_reject_unsupported_formats():
    # GIF format
    gif_buf = io.BytesIO()
    img_gif = Image.new("RGB", (10, 10), color="blue")
    img_gif.save(gif_buf, format="GIF")
    with pytest.raises(ImageError, match="Unsupported image format"):
        normalize_image(gif_buf.getvalue())

    # BMP format
    bmp_buf = io.BytesIO()
    img_bmp = Image.new("RGB", (10, 10), color="red")
    img_bmp.save(bmp_buf, format="BMP")
    with pytest.raises(ImageError, match="Unsupported image format"):
        normalize_image(bmp_buf.getvalue())


def test_reject_exceeds_max_size():
    fake_huge = b"0" * (5 * 1024 * 1024 + 1)
    with pytest.raises(ImageError, match="exceeds maximum allowed 5 MB"):
        normalize_image(fake_huge)


def test_metadata_removal():
    # Create image with EXIF metadata
    img = Image.new("RGB", (100, 100), color="green")
    exif = img.getexif()
    exif[0x010E] = "Sensitive Metadata / Camera Information"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    input_bytes = buf.getvalue()

    # Verify input has EXIF
    with Image.open(io.BytesIO(input_bytes)) as check_in:
        in_exif = check_in.getexif()
        assert 0x010E in in_exif

    # Normalize image
    output_bytes = normalize_image(input_bytes)

    # Verify output has metadata dropped and is valid JPEG
    with Image.open(io.BytesIO(output_bytes)) as check_out:
        assert check_out.format == "JPEG"
        out_exif = check_out.getexif()
        assert 0x010E not in out_exif
        assert len(out_exif) == 0


def test_resize_longest_side_over_2048():
    # 3000 x 1500 image
    img = Image.new("RGB", (3000, 1500), color="yellow")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    input_bytes = buf.getvalue()

    output_bytes = normalize_image(input_bytes)
    with Image.open(io.BytesIO(output_bytes)) as check_out:
        assert check_out.size == (2048, 1024)


def test_png_normalized_to_jpeg():
    # PNG format is accepted and re-encoded to JPEG
    png_buf = io.BytesIO()
    img_png = Image.new("RGBA", (120, 80), color=(255, 0, 0, 128))
    img_png.save(png_buf, format="PNG")

    output_bytes = normalize_image(png_buf.getvalue())
    with Image.open(io.BytesIO(output_bytes)) as check_out:
        assert check_out.format == "JPEG"
        assert check_out.size == (120, 80)
