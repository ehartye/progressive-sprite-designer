"""
Generate a 36-cell sprite sheet template grid sized for 1K (1024x1024) output.

Same layout and labels as the full-size template, but scaled to match the
1K output resolution so Gemini doesn't have to resize — better label accuracy.

Layout: 6 columns × 6 rows
"""

from PIL import Image, ImageDraw, ImageFont
import os

# ── Grid configuration (sized for ~1024x1024) ─────────────────────────────
COLS = 6
ROWS = 6
CELL_W = 168          # content width per cell
CELL_H = 168          # total cell height (header + content)
HEADER_H = 16         # title strip height (scaled down)
BORDER = 1            # grid line thickness

CHROMA_PINK = (255, 0, 255)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)

FONT_PATH = "C:/Windows/Fonts/arialbd.ttf"
FONT_SIZE = 10

# ── Sprite labels (36 total) ────────────────────────────────────────────────
LABELS = [
    # Walk frames: 4 directions × 3 frames = 12
    "Walk Down 1",   "Walk Down 2",   "Walk Down 3",
    "Walk Up 1",     "Walk Up 2",     "Walk Up 3",
    "Walk Left 1",   "Walk Left 2",   "Walk Left 3",
    "Walk Right 1",  "Walk Right 2",  "Walk Right 3",

    # Idle: 4 directions × 1 = 4
    "Idle Down",     "Idle Up",       "Idle Left",      "Idle Right",

    # Battle: 6 poses × 3 frames = 18
    "Battle Idle 1", "Battle Idle 2", "Battle Idle 3",
    "Attack 1",      "Attack 2",      "Attack 3",
    "Cast 1",        "Cast 2",        "Cast 3",
    "Damage 1",      "Damage 2",      "Damage 3",
    "KO 1",          "KO 2",          "KO 3",
    "Victory 1",     "Victory 2",     "Victory 3",

    # Weak / Critical = 2
    "Weak Pose",     "Critical Pose",
]

assert len(LABELS) == COLS * ROWS, f"Expected {COLS*ROWS} labels, got {len(LABELS)}"

# ── Compute canvas size ─────────────────────────────────────────────────────
img_w = COLS * CELL_W + (COLS + 1) * BORDER
img_h = ROWS * CELL_H + (ROWS + 1) * BORDER

print(f"Canvas: {img_w} x {img_h}")

# ── Draw ─────────────────────────────────────────────────────────────────────
img = Image.new("RGB", (img_w, img_h), BLACK)
draw = ImageDraw.Draw(img)
font = ImageFont.truetype(FONT_PATH, FONT_SIZE)

for idx, label in enumerate(LABELS):
    col = idx % COLS
    row = idx // COLS

    x0 = BORDER + col * (CELL_W + BORDER)
    y0 = BORDER + row * (CELL_H + BORDER)

    # Header strip (black background, white text)
    draw.rectangle([x0, y0, x0 + CELL_W - 1, y0 + HEADER_H - 1], fill=BLACK)
    bbox = font.getbbox(label)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = x0 + (CELL_W - tw) // 2
    ty = y0 + (HEADER_H - th) // 2 - bbox[1]
    draw.text((tx, ty), label, fill=WHITE, font=font)

    # Content area (chroma pink)
    draw.rectangle(
        [x0, y0 + HEADER_H, x0 + CELL_W - 1, y0 + CELL_H - 1],
        fill=CHROMA_PINK,
    )

# ── Save ─────────────────────────────────────────────────────────────────────
out_path = os.path.join(os.path.dirname(__file__), "sprite_grid_template_1k.png")
img.save(out_path, "PNG")
print(f"Saved: {out_path}")
