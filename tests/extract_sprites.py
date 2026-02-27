"""
Extract sprites from a filled grid template image:
  1. Slice the grid into 36 cells (skip header strips)
  2. Flood-fill from corners to find background (any color)
  3. Erode alpha to kill fringe, remove small islands
  4. Auto-crop each sprite to its bounding box
  5. Pad all sprites to a uniform size (largest bbox)
  6. Arrange into a clean sprite sheet with transparent background
"""

from PIL import Image
import numpy as np
from scipy import ndimage
from scipy.ndimage import binary_erosion, binary_dilation
from collections import deque
import os

# ── Config ───────────────────────────────────────────────────────────────────
COLS = 6
ROWS = 6

# Template dimensions — auto-detected from whichever template was used.
# Supports both the full-size (2822) and 1K (1015) templates.
TEMPLATES = {
    # (tmpl_w, tmpl_h): (cell_w, cell_h, header_h, border)
    2822: (468, 468, 28, 2),  # full-size
    1015: (168, 168, 16, 1),  # 1K
}

# Detect which template was used based on output aspect/scale
# (overridden below after loading the image)
TMPL_W = 2822
TMPL_H = 2822
TMPL_CELL_W = 468
TMPL_CELL_H = 468
TMPL_HEADER_H = 28
TMPL_BORDER = 2

# Flood-fill tolerance: max RGB distance to seed color to count as background
FLOOD_TOLERANCE = 45
# Interior void tolerance: tighter than flood fill to avoid eating dark sprite areas
# (shadows under hat brims are close to bg color — keep this conservative)
INTERIOR_TOLERANCE = 20
# Defringe width: how many pixels from the bg boundary to decontaminate
DEFRINGE_WIDTH = 4
# Min connected-component area to keep (removes stray pixel noise)
MIN_ISLAND = 20
# Border pixels to blank (kills grid-line / header bleed)
BORDER_BLANK = 6

INPUT = os.path.join(os.path.dirname(__file__), "test_swamp_monster_output_nano.png")
OUTPUT = os.path.join(os.path.dirname(__file__), "swamp_monster_spritesheet.png")
DEBUG_DIR = os.path.join(os.path.dirname(__file__), "debug_cells")

LABELS = [
    "Walk Down 1",   "Walk Down 2",   "Walk Down 3",
    "Walk Up 1",     "Walk Up 2",     "Walk Up 3",
    "Walk Left 1",   "Walk Left 2",   "Walk Left 3",
    "Walk Right 1",  "Walk Right 2",  "Walk Right 3",
    "Idle Down",     "Idle Up",       "Idle Left",      "Idle Right",
    "Battle Idle 1", "Battle Idle 2", "Battle Idle 3",
    "Attack 1",      "Attack 2",      "Attack 3",
    "Cast 1",        "Cast 2",        "Cast 3",
    "Damage 1",      "Damage 2",      "Damage 3",
    "KO 1",          "KO 2",          "KO 3",
    "Victory 1",     "Victory 2",     "Victory 3",
    "Weak Pose",     "Critical Pose",
]


# ── Background removal via flood fill ───────────────────────────────────────

def flood_fill_bg(cell_img, tolerance=FLOOD_TOLERANCE):
    """
    Detect background by flood-filling from all four corners and edges.

    Each seed region remembers its anchor color (median of a corner patch).
    Every candidate pixel is compared against the *anchor* — not its neighbor.
    This prevents gradient-drift from leaking the fill into the sprite.
    """
    arr = np.array(cell_img, dtype=np.float32)
    rgb = arr[:, :, :3]
    h, w = rgb.shape[:2]
    bg_mask = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)
    tol_sq = tolerance * tolerance

    # Inset past border artifacts (grid lines bleed dark pixels into corners)
    ins = BORDER_BLANK + 2
    patch = 8

    # Compute anchor colors from inset corner patches
    corner_patches = [
        rgb[ins:ins+patch, ins:ins+patch],
        rgb[ins:ins+patch, -(ins+patch):-ins],
        rgb[-(ins+patch):-ins, ins:ins+patch],
        rgb[-(ins+patch):-ins, -(ins+patch):-ins],
    ]
    corner_seeds = [
        (ins, ins),
        (ins, w - 1 - ins),
        (h - 1 - ins, ins),
        (h - 1 - ins, w - 1 - ins),
    ]

    # Also seed from inset edge midpoints
    edge_seeds = [
        (ins, w // 2),
        (h - 1 - ins, w // 2),
        (h // 2, ins),
        (h // 2, w - 1 - ins),
    ]
    edge_patches = [
        rgb[ins:ins+patch, w//2 - patch//2 : w//2 + patch//2],
        rgb[-(ins+patch):-ins, w//2 - patch//2 : w//2 + patch//2],
        rgb[h//2 - patch//2 : h//2 + patch//2, ins:ins+patch],
        rgb[h//2 - patch//2 : h//2 + patch//2, -(ins+patch):-ins],
    ]

    all_seeds = corner_seeds + edge_seeds
    all_patches = corner_patches + edge_patches
    anchors = []

    for (sy, sx), patch_arr in zip(all_seeds, all_patches):
        anchor = np.median(patch_arr.reshape(-1, 3), axis=0)

        if visited[sy, sx]:
            continue

        # Check if this seed looks like it could be background
        # (i.e., the seed pixel is close to the patch median)
        seed_diff = rgb[sy, sx] - anchor
        if float(seed_diff[0]**2 + seed_diff[1]**2 + seed_diff[2]**2) > tol_sq:
            continue

        anchors.append(anchor)
        queue = deque()
        visited[sy, sx] = True
        bg_mask[sy, sx] = True
        queue.append((sy, sx))

        while queue:
            cy, cx = queue.popleft()
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                    visited[ny, nx] = True
                    diff = rgb[ny, nx] - anchor
                    dist_sq = float(diff[0]**2 + diff[1]**2 + diff[2]**2)
                    if dist_sq <= tol_sq:
                        bg_mask[ny, nx] = True
                        queue.append((ny, nx))

    return bg_mask, anchors


def remove_background(cell_img):
    """
    Full background removal pipeline:
      1. Flood-fill from corners/edges to find connected background
      2. Compute bg color from flood-filled region
      3. Global color-distance pass to catch interior voids (enclosed bg)
      4. Soft alpha fringe at sprite edges instead of hard erosion
    """
    from scipy.ndimage import distance_transform_edt

    bg_mask, anchors = flood_fill_bg(cell_img)
    arr = np.array(cell_img, dtype=np.float32)
    rgb = arr[:, :, :3]

    # Compute the actual bg color from the flood-filled region
    if np.any(bg_mask):
        bg_color = np.median(rgb[bg_mask], axis=0)
    elif anchors:
        bg_color = np.mean(anchors, axis=0)
    else:
        bg_color = rgb[0, 0]

    # ── Interior void pass ───────────────────────────────────────────────
    # Catch bg-colored regions NOT connected to edges (e.g. inside fire ring)
    dist_to_bg = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))
    interior_mask = dist_to_bg < INTERIOR_TOLERANCE

    # Combine: edge-connected flood fill + interior color match
    full_bg = bg_mask | interior_mask

    # ── Color decontamination (defringe) ────────────────────────────────
    # Edge pixels are a blend: pixel = alpha * sprite + (1-alpha) * bg
    # We estimate alpha from color distance and solve for the original
    # sprite color, giving clean edges that composite over any background.
    result = np.array(cell_img, dtype=np.float64)
    rgb_f = result[:, :, :3].astype(np.float64)
    bg = bg_color.astype(np.float64)

    # Hard-remove everything that's clearly background
    result[full_bg] = [0, 0, 0, 0]

    if DEFRINGE_WIDTH > 0:
        sprite_mask = ~full_bg
        dist_from_bg = distance_transform_edt(sprite_mask)

        # Defringe zone: sprite pixels near the bg boundary
        fringe_zone = (dist_from_bg > 0) & (dist_from_bg <= DEFRINGE_WIDTH)
        fringe_coords = np.where(fringe_zone)

        if len(fringe_coords[0]) > 0:
            fringe_rgb = rgb_f[fringe_coords]  # Nx3
            fringe_dist = dist_from_bg[fringe_coords]  # N

            # Estimate alpha for each fringe pixel:
            # alpha = how different this pixel is from bg, normalized
            # If pixel == bg, alpha ≈ 0. If pixel is very different, alpha ≈ 1.
            diff_from_bg = fringe_rgb - bg  # Nx3
            pixel_bg_dist = np.sqrt(np.sum(diff_from_bg ** 2, axis=1))

            # Max possible distance (used for normalization)
            max_dist = FLOOD_TOLERANCE * 2.0

            # Alpha from color: how much sprite vs bg is in this pixel
            alpha_color = np.clip(pixel_bg_dist / max_dist, 0, 1)

            # Alpha from spatial distance: closer to bg = more contaminated
            alpha_spatial = np.clip(fringe_dist / DEFRINGE_WIDTH, 0, 1)

            # Combined alpha: use the more conservative (lower) estimate
            # but bias toward color-based since it's more accurate
            alpha = np.clip(alpha_color * 0.7 + alpha_spatial * 0.3, 0.05, 1.0)

            # Solve for decontaminated sprite color:
            # pixel = alpha * sprite + (1-alpha) * bg
            # sprite = (pixel - (1-alpha) * bg) / alpha
            alpha_3 = alpha[:, np.newaxis]  # Nx1
            decontam = (fringe_rgb - (1.0 - alpha_3) * bg) / np.maximum(alpha_3, 0.1)
            decontam = np.clip(decontam, 0, 255)

            # Write back
            result[fringe_coords[0], fringe_coords[1], 0] = decontam[:, 0]
            result[fringe_coords[0], fringe_coords[1], 1] = decontam[:, 1]
            result[fringe_coords[0], fringe_coords[1], 2] = decontam[:, 2]
            result[fringe_coords[0], fringe_coords[1], 3] = (alpha * 255).astype(np.float64)

    return Image.fromarray(result.astype(np.uint8), "RGBA")


def clean_border_artifacts(img_rgba, border_px=BORDER_BLANK):
    """Zero out a thin border around the cell to kill grid-line / AA artifacts."""
    arr = np.array(img_rgba)
    arr[:border_px, :, 3] = 0
    arr[-border_px:, :, 3] = 0
    arr[:, :border_px, 3] = 0
    arr[:, -border_px:, 3] = 0
    return Image.fromarray(arr, "RGBA")


def remove_small_islands(img_rgba, min_area=MIN_ISLAND):
    """Remove tiny opaque blobs (stray pixels / noise)."""
    arr = np.array(img_rgba)
    alpha = arr[:, :, 3] > 0
    labeled, num_features = ndimage.label(alpha)
    for i in range(1, num_features + 1):
        if np.sum(labeled == i) < min_area:
            arr[labeled == i, 3] = 0
    return Image.fromarray(arr, "RGBA")


def find_bbox(img_rgba):
    """Find bounding box of non-transparent pixels."""
    arr = np.array(img_rgba)
    alpha = arr[:, :, 3]
    rows_with_content = np.any(alpha > 0, axis=1)
    cols_with_content = np.any(alpha > 0, axis=0)
    if not np.any(rows_with_content):
        return None
    y0 = np.argmax(rows_with_content)
    y1 = len(rows_with_content) - np.argmax(rows_with_content[::-1])
    x0 = np.argmax(cols_with_content)
    x1 = len(cols_with_content) - np.argmax(cols_with_content[::-1])
    return (x0, y0, x1, y1)


# ── Load ─────────────────────────────────────────────────────────────────────
img = Image.open(INPUT).convert("RGBA")
w, h = img.size
print(f"Input: {w}x{h}")

# Auto-detect template: pick the one whose scale factor is closest to 1.0
# (Gemini outputs at the requested resolution regardless of template size,
#  so the template whose cells most closely match the output cells wins)
best_tmpl = None
best_err = float('inf')
for tmpl_size, (cw, ch, hh, bw) in TEMPLATES.items():
    scale = w / tmpl_size
    err = abs(scale - 1.0)
    if err < best_err:
        best_err = err
        best_tmpl = tmpl_size

TMPL_W = best_tmpl
TMPL_H = best_tmpl
TMPL_CELL_W, TMPL_CELL_H, TMPL_HEADER_H, TMPL_BORDER = TEMPLATES[best_tmpl]
print(f"Detected template: {TMPL_W}x{TMPL_H} (cell {TMPL_CELL_W}, header {TMPL_HEADER_H}, border {TMPL_BORDER})")

sx = w / TMPL_W
sy = h / TMPL_H
print(f"Scale: {sx:.3f}x, {sy:.3f}y")

cell_w = round(TMPL_CELL_W * sx)
cell_h = round(TMPL_CELL_H * sy)
header_h = round(TMPL_HEADER_H * sy)
border = round(TMPL_BORDER * sx)

print(f"Scaled cell: {cell_w}x{cell_h}, header: {header_h}px, border: {border}px")

# ── Slice & process cells ────────────────────────────────────────────────────
os.makedirs(DEBUG_DIR, exist_ok=True)

sprites = []
max_sprite_w = 0
max_sprite_h = 0

for idx in range(COLS * ROWS):
    col = idx % COLS
    row = idx // COLS

    x0 = round(border + col * (TMPL_CELL_W + TMPL_BORDER) * sx)
    y0 = round((border + row * (TMPL_CELL_H + TMPL_BORDER)) * sy) + header_h
    x1 = x0 + cell_w
    y1 = round((border + row * (TMPL_CELL_H + TMPL_BORDER)) * sy) + cell_h

    x1 = min(x1, w)
    y1 = min(y1, h)

    cell = img.crop((x0, y0, x1, y1))

    # Detect bg color for logging
    cell_arr = np.array(cell, dtype=np.float32)[:, :, :3]
    corner_color = cell_arr[2, 2].astype(int)

    # Pipeline: flood-fill bg removal -> border cleanup -> island removal
    keyed = remove_background(cell)
    keyed = clean_border_artifacts(keyed)
    keyed = remove_small_islands(keyed)

    keyed.save(os.path.join(DEBUG_DIR, f"{idx:02d}_{LABELS[idx].replace(' ', '_')}.png"))

    bbox = find_bbox(keyed)
    if bbox is None:
        print(f"  [{idx:02d}] {LABELS[idx]} — EMPTY  bg=({corner_color[0]},{corner_color[1]},{corner_color[2]})")
        sprites.append(None)
        continue

    cropped = keyed.crop(bbox)
    sw, sh = cropped.size
    max_sprite_w = max(max_sprite_w, sw)
    max_sprite_h = max(max_sprite_h, sh)
    sprites.append(cropped)

    # Count what % was removed as bg
    total_px = cell_w * (cell_h - header_h)
    bg_removed = total_px - np.sum(np.array(keyed)[:, :, 3] > 0)
    pct = 100 * bg_removed / total_px

    print(f"  [{idx:02d}] {LABELS[idx]}: {sw}x{sh}  bg=({corner_color[0]},{corner_color[1]},{corner_color[2]}) removed={pct:.0f}%")

# ── Uniform padding ─────────────────────────────────────────────────────────
MARGIN = 4
uniform_w = max_sprite_w + MARGIN * 2
uniform_h = max_sprite_h + MARGIN * 2

print(f"\nMax sprite size: {max_sprite_w}x{max_sprite_h}")
print(f"Uniform cell (with {MARGIN}px margin): {uniform_w}x{uniform_h}")

# ── Assemble sprite sheet ───────────────────────────────────────────────────
sheet_w = COLS * uniform_w
sheet_h = ROWS * uniform_h
sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

for idx, sprite in enumerate(sprites):
    if sprite is None:
        continue

    col = idx % COLS
    row = idx // COLS
    sw, sh = sprite.size

    cx = col * uniform_w + (uniform_w - sw) // 2
    cy = row * uniform_h + (uniform_h - sh - MARGIN)

    sheet.paste(sprite, (cx, cy), sprite)

sheet.save(OUTPUT, "PNG")
print(f"\nSprite sheet saved: {OUTPUT}")
print(f"Sheet dimensions: {sheet_w}x{sheet_h}")
print(f"Cell size: {uniform_w}x{uniform_h} ({COLS} cols x {ROWS} rows)")
