#!/usr/bin/env python3
"""Crop portrait photos to the Webis house format (3:4, uniform head size).

Detects the face via Apple's Vision framework, composes a 3:4 crop with
uniform framing (face height ~= 51% of crop height, face center at ~51%
from the top; measured from the hand-made Temir crops), and writes two
files per input:

  <out>/master/<key>.jpg   -- crop at source resolution, capped at 840x1120
  <out>/105x140/<key>.jpg  -- the display derivative (105x140)

Usage: crop-portraits.py --out DIR IMAGE [IMAGE ...]

Exit report: one line per image (ok / no-face / low-res warning).
"""

import argparse
import os
import sys

import Quartz
import Vision
from PIL import Image, ImageFilter, ImageOps

RATIO = 105 / 140            # width / height = 3:4
# Framing constants measured from the 33 hand-made Temir crops (2026-09),
# median face-box height and vertical center across the set.
FACE_FRACTION = 0.51         # face-box height as fraction of crop height
FACE_CENTER_Y = 0.51         # face-box center at 51% from crop top
MASTER_MAX = (840, 1120)     # 8x display size
# Sources already at exactly 105x140 (the house convention) carry no
# pixels to spare: cropping or rescaling them only destroys information.
# They pass through untouched as master; only the derivative is sharpened.
DERIVATIVE = (105, 140)
# Output sharpening: downscaling always softens; a small-radius unsharp
# mask on the derivative restores edge contrast (standard export practice).
# Applied ONLY after an actual downscale — never in passthrough. Moderate
# strength: at 105 px width, percent=100 already looks unnaturally crunchy
# on some portraits.
SHARPEN = ImageFilter.UnsharpMask(radius=1.0, percent=70, threshold=2)
JPEG_OPTS = dict(quality=85, optimize=True, progressive=True)


def detect_face(path, size):
    """Return the largest face box as (x, y, w, h) in pixels, or None.

    The file at `path` must already be orientation-normalized (no EXIF
    rotation) so Vision's coordinates match PIL's pixel grid.
    """
    url = Quartz.CFURLCreateWithFileSystemPath(
        None, path, Quartz.kCFURLPOSIXPathStyle, False)
    handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
    request = Vision.VNDetectFaceRectanglesRequest.alloc().init()
    ok, _err = handler.performRequests_error_([request], None)
    if not ok or not request.results():
        return None
    iw, ih = size
    best = max(request.results(), key=lambda r: r.boundingBox().size.height)
    bb = best.boundingBox()  # normalized, origin bottom-left
    x = bb.origin.x * iw
    w = bb.size.width * iw
    h = bb.size.height * ih
    y = (1 - bb.origin.y - bb.size.height) * ih  # convert to top-left origin
    return (x, y, w, h)


def compose_crop(face, size, min_headroom=None):
    """Return a 3:4 crop box (left, top, right, bottom) framing the face.

    The calibrated centering yields 50% of the face height as headroom above
    the face box. That fits most portraits: Vision's box usually includes the
    hair. For heads whose skull rises far above the box (bald heads, or a
    shrunk crop that clips at the top), pass min_headroom (fraction of face
    height, e.g. 0.6) to force more air above the head; the face shifts
    off-center accordingly, and the source's own edge is the hard limit.
    A blanket minimum is wrong: it would lower every normal face.
    """
    iw, ih = size
    fx, fy, fw, fh = face
    ch = fh / FACE_FRACTION
    cw = ch * RATIO
    # Shrink if the crop exceeds the image in either dimension.
    scale = min(iw / cw, ih / ch, 1.0)
    cw, ch = cw * scale, ch * scale
    left = fx + fw / 2 - cw / 2
    top = fy + fh / 2 - FACE_CENTER_Y * ch
    if scale < 1 and min_headroom is None:
        min_headroom = 0.65  # shrunk crops clip heads without a guarantee
    if min_headroom is not None:
        top = min(top, fy - min_headroom * fh)
    left = max(0, min(left, iw - cw))
    top = max(0, min(top, ih - ch))
    return (round(left), round(top), round(left + cw), round(top + ch))


def process(path, out, min_headroom=None):
    key = os.path.splitext(os.path.basename(path))[0]
    with Image.open(path) as raw:
        oriented = raw.getexif().get(0x0112, 1) != 1  # EXIF Orientation tag
        im = ImageOps.exif_transpose(raw).convert("RGB")
    detect_path = path
    tmp = None
    if oriented:  # write a normalized copy so Vision sees PIL's pixel grid
        tmp = os.path.join(out, f".{key}-normalized.jpg")
        im.save(tmp, quality=95)
        detect_path = tmp
    try:
        face = detect_face(detect_path, im.size)
    finally:
        if tmp:
            os.remove(tmp)
    if im.size == DERIVATIVE:
        # Sharpening is downscale compensation only: with no scaling done,
        # it would just amplify legacy JPEG artifacts. Copy as is, twice.
        import shutil
        ext = os.path.splitext(path)[1].lower()
        shutil.copyfile(path, os.path.join(out, "master", key + ext))
        shutil.copyfile(path, os.path.join(out, "105x140", key + ext))
        return f"ok    {key}: passthrough {im.size[0]}x{im.size[1]} (no crop/scale/sharpen)"
    if face is None:
        return f"SKIP  {key}: no face detected"
    crop = im.crop(compose_crop(face, im.size, min_headroom))
    master = crop.copy()
    master.thumbnail(MASTER_MAX, Image.Resampling.LANCZOS)
    master.save(os.path.join(out, "master", key + ".jpg"), **JPEG_OPTS)
    derivative = crop.resize(DERIVATIVE, Image.Resampling.LANCZOS).filter(SHARPEN)
    derivative.save(os.path.join(out, "105x140", key + ".jpg"), **JPEG_OPTS)
    warn = "  (low-res: master below 210x280)" if master.size[0] < 210 else ""
    return f"ok    {key}: crop {crop.size[0]}x{crop.size[1]} -> master {master.size[0]}x{master.size[1]}{warn}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--min-headroom", type=float, default=None, metavar="FRAC",
                    help="minimum air above the face box as a fraction of face"
                         " height (e.g. 0.6 for bald heads); default: pure"
                         " calibrated centering")
    ap.add_argument("images", nargs="+")
    args = ap.parse_args()
    os.makedirs(os.path.join(args.out, "master"), exist_ok=True)
    os.makedirs(os.path.join(args.out, "105x140"), exist_ok=True)
    failures = 0
    for path in args.images:
        line = process(path, args.out, args.min_headroom)
        failures += line.startswith("SKIP")
        print(line)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
