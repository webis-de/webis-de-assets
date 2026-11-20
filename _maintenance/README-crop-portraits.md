# crop-portraits.py — Webis portrait crop tool

Crops person photos to the Webis house portrait format: **3:4 ratio, uniform head size** (reference: `img/people/silhouette-male.jpg`, 105×140). Face detection runs locally via Apple's Vision framework — no cloud calls, no generative model, faces are never altered.

Per input image it writes two files:

| Output                    | Purpose                                                                                                                                                     |
|---------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `<out>/master/<key>.jpg`  | Crop at source resolution, capped at 840×1120 — the file the central image registry (`assets.webis.de/img/people/`) should store                            |
| `<out>/105x140/<key>.jpg` | Display derivative used by the site templates (output-sharpened after downscaling: unsharp mask, radius 1.0, percent 70; passthrough images stay untouched) |

The derivative is reproducible from the master at any time; only the master needs to be kept authoritative.

## Target format

If you cannot run the script (it needs a Mac), crop by hand to these values. Both files show the same crop.

| Property              | Thumbnail                                                      | Master                                   |
|-----------------------|----------------------------------------------------------------|------------------------------------------|
| Aspect ratio          | 3:4 (width:height), portrait                                   | 3:4 (width:height), portrait             |
| Size                  | exactly 105×140 px                                             | at least 210×280 px, at most 840×1120 px |
| Format                | JPEG, `<key>.jpg`                                              | JPEG, `<key>.jpg`                        |
| Location in this repo | `img/event-people/<key>.jpg` (`img/people/` for Webis members) | `img/event-people/master/<key>.jpg`      |

- **Key:** the person's last name in lowercase ASCII, e.g. `goedel`; if that is already taken in `img/people/` or `img/event-people/` by someone else, append the first name, e.g. `goedel-kurt`.
- **Head size:** the face (chin to top of forehead) takes about half of the image height.
- **Head position:** face centered horizontally, its center at about half of the image height, which leaves roughly half a face height of air above the forehead.
- **One person, no edits:** crop only; no retouching, no generated background.
- **Example:** `_maintenance/example/example.jpg` and `_maintenance/example/master/example.jpg`, a drawn placeholder framed exactly by these rules.

## Framing rule

Face box height ≈ 51% of crop height, face center at 51% from the top — both values are the median measured across the 33 hand-made Temir crops (2026-09), so script output matches them. Constants at the top of the script (`FACE_FRACTION`, `FACE_CENTER_Y`) tune this globally.

## Requirements

macOS only (uses the system Vision framework via pyobjc). Run the tool on your Mac, then upload the outputs; the server never runs it.

```sh
cd _maintenance
python3 -m venv .venv-crop
./.venv-crop/bin/pip install -r requirements-crop.txt
```

## Usage

```sh
./.venv-crop/bin/python crop-portraits.py --out cropped photo1.jpg photo2.png ...
```

One report line per image. `SKIP <key>: no face detected` means the image needs a manual crop (also triggered by silhouette placeholders — that is intentional). A `low-res` warning marks masters below 210×280, i.e. sources too small for a good master; prefer re-sourcing those photos.

**Passthrough rule:** a source that is already exactly 105×140 (the house convention) is never cropped, rescaled, or sharpened — sharpening is downscale compensation only, and with no scaling done it would just amplify legacy JPEG artifacts. Master and derivative are byte-identical copies of the original. The report line says `passthrough`.

`--min-headroom FRAC` forces at least FRAC of the face height as air above the face box (e.g. `0.6` for bald heads, whose skull rises far above Vision's box). Default is the pure calibrated centering (50% headroom), which fits most portraits; shrunk crops fall back to 0.65 automatically. Use the flag per image, not globally — a blanket minimum would lower every normal face.

Images with EXIF rotation are normalized before detection and cropping. When an image contains several faces, the largest one wins — crop group photos manually.
