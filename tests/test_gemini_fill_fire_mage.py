"""
Quick test: send the sprite grid template to Gemini Nano Banana Pro and ask
it to fill in the cells with an SNES-style fire mage character.
"""

import base64
import json
import os
import sys
import urllib.request
import urllib.error

# ── Config ───────────────────────────────────────────────────────────────────
API_KEY = None
MODEL = "nano-banana-pro-preview"
TEMPLATE = os.path.join(os.path.dirname(__file__), "sprite_grid_template_1k.png")
OUTPUT = os.path.join(os.path.dirname(__file__), "test_fire_mage_output_nano.png")

# Try to load key from .env.local
env_path = os.path.join(os.path.dirname(__file__), ".env.local")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                API_KEY = line.strip().split("=", 1)[1]

if not API_KEY:
    print("Error: No GEMINI_API_KEY found in .env.local")
    sys.exit(1)

# ── Load template as base64 ─────────────────────────────────────────────────
with open(TEMPLATE, "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode("utf-8")

print(f"Template loaded: {TEMPLATE}")
print(f"Base64 size: {len(img_b64):,} chars")

# ── Build prompt with per-cell descriptions ──────────────────────────────────
PROMPT = """\
You are filling in a sprite sheet template. The attached image is a 6×6 grid
(36 cells) on a bright magenta (#FF00FF) chroma-key background. Each cell has
a thin black header strip with white text labeling the pose. You MUST preserve
every header strip and its text exactly as-is — do not erase, move, or redraw
them.

Fill every pink cell area with an SNES-era 16-bit pixel-art sprite of a
FIRE MAGE character. The character design:
  • Pointed wide-brim wizard hat (dark crimson with gold trim)
  • Flowing red-orange robes with ember-glow highlights
  • Carries a gnarled wooden staff topped with a flickering flame orb
  • Pale skin, determined expression
  • Style reference: Final Fantasy VI / Chrono Trigger overworld + battle sprites
  • Consistent proportions and palette across ALL 36 cells

Keep the magenta #FF00FF background behind each sprite for chroma keying.
Do NOT draw outside the cell boundaries or over the black grid lines.

CENTERING IS CRITICAL: Every sprite must be precisely centered both
horizontally and vertically within its cell's pink content area (below the
header strip). The character's feet should rest at a consistent baseline
roughly 80% down the cell, and the sprite should be horizontally centered
with equal pink space on the left and right. Standing poses should all share
the same vertical baseline so they tile cleanly. Even action poses (attack
swings, casting, damage recoil) must keep the character's center of mass
near the middle of the cell — do not let poses drift to the edges. KO/lying
poses should be centered horizontally even though they are low to the ground.

Below is the exact layout with a description of what each cell should depict.
Row and column numbers are 0-indexed (row, col).

ROW 0 — Walk Down (top-down overworld, character facing the camera):
  (0,0) "Walk Down 1" — left foot forward, arms at sides, staff in right hand
  (0,1) "Walk Down 2" — neutral standing mid-step, feet together (contact pose)
  (0,2) "Walk Down 3" — right foot forward, mirror of frame 1
  (0,3) "Walk Up 1"   — character facing away, left foot forward, cape visible
  (0,4) "Walk Up 2"   — neutral standing mid-step facing away
  (0,5) "Walk Up 3"   — right foot forward facing away, mirror of frame 1

ROW 1 — Walk Left & Right (top-down overworld, side views):
  (1,0) "Walk Left 1"  — facing left, left foot forward, staff visible
  (1,1) "Walk Left 2"  — facing left, neutral contact pose
  (1,2) "Walk Left 3"  — facing left, right foot forward
  (1,3) "Walk Right 1" — facing right, right foot forward, staff visible
  (1,4) "Walk Right 2" — facing right, neutral contact pose
  (1,5) "Walk Right 3" — facing right, left foot forward

ROW 2 — Idle & Battle Idle:
  (2,0) "Idle Down"     — relaxed standing pose facing camera, weight centered
  (2,1) "Idle Up"       — relaxed standing pose facing away
  (2,2) "Idle Left"     — relaxed standing pose facing left
  (2,3) "Idle Right"    — relaxed standing pose facing right
  (2,4) "Battle Idle 1" — side-view battle stance, staff raised, slight crouch, frame 1
  (2,5) "Battle Idle 2" — battle stance with subtle breathing/sway motion, frame 2

ROW 3 — Battle Idle 3, Attack sequence, Cast start:
  (3,0) "Battle Idle 3" — battle stance sway, frame 3 (loops back to frame 1)
  (3,1) "Attack 1"      — wind-up: staff pulled back, body coiled
  (3,2) "Attack 2"      — mid-swing: staff sweeping forward, fire trail from orb
  (3,3) "Attack 3"      — follow-through: staff fully extended, burst of embers
  (3,4) "Cast 1"        — arms raised, staff held overhead, gathering energy, small flame swirl
  (3,5) "Cast 2"        — casting: eyes glowing, large fire circle forming around staff tip

ROW 4 — Cast 3, Damage, KO:
  (4,0) "Cast 3"   — spell release: huge fireball erupting from staff, robes billowing
  (4,1) "Damage 1" — hit recoil: flinching backward, arms up to shield face
  (4,2) "Damage 2" — stagger: leaning further back, hat askew, pain expression
  (4,3) "Damage 3" — recovery: stumbling forward catching balance
  (4,4) "KO 1"     — collapsing: knees buckling, staff slipping from hand
  (4,5) "KO 2"     — falling: body hitting the ground sideways, hat flying off

ROW 5 — KO 3, Victory, Weak/Critical:
  (5,0) "KO 3"          — fully down: lying flat on ground, eyes closed (X eyes), staff beside body
  (5,1) "Victory 1"     — celebration start: jumping up, staff raised triumphantly
  (5,2) "Victory 2"     — mid-celebration: staff overhead, fire sparkles erupting
  (5,3) "Victory 3"     — celebration end: confident pose, staff planted, smirk
  (5,4) "Weak Pose"     — hunched over, one knee on ground, panting, staff used as crutch, low HP
  (5,5) "Critical Pose" — desperate stance, one eye closed, flickering aura, near death

Return the completed sprite sheet as a single image. Preserve ALL header text exactly."""

body = {
    "contents": [
        {
            "parts": [
                {
                    "inline_data": {
                        "mime_type": "image/png",
                        "data": img_b64,
                    }
                },
                {"text": PROMPT},
            ]
        }
    ],
    "generationConfig": {
        "responseModalities": ["TEXT", "IMAGE"],
        "temperature": 1.0,
        "imageConfig": {
            "aspectRatio": "1:1",
            "imageSize": "1K",
        },
    },
}

# ── Call Gemini ──────────────────────────────────────────────────────────────
url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

req = urllib.request.Request(
    url,
    data=json.dumps(body).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
    },
    method="POST",
)

print(f"\nCalling {MODEL}...")
print("(This may take a while for image generation)\n")

try:
    with urllib.request.urlopen(req, timeout=300) as resp:
        result = json.loads(resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    error_body = e.read().decode("utf-8")
    print(f"HTTP {e.code} Error:")
    print(error_body[:2000])
    sys.exit(1)

# ── Parse response ───────────────────────────────────────────────────────────
texts = []
image_data = None

candidates = result.get("candidates", [])
if not candidates:
    print("No candidates in response!")
    print(json.dumps(result, indent=2)[:2000])
    sys.exit(1)

parts = candidates[0].get("content", {}).get("parts", [])

for part in parts:
    if "text" in part:
        texts.append(part["text"])
    if "inlineData" in part:
        image_data = part["inlineData"]

if texts:
    print("Gemini said:")
    print("\n".join(texts)[:500])
    print()

if image_data:
    img_bytes = base64.b64decode(image_data["data"])
    with open(OUTPUT, "wb") as f:
        f.write(img_bytes)
    print(f"Output saved: {OUTPUT} ({len(img_bytes):,} bytes)")

    # Show image dimensions
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(img_bytes))
    print(f"Output dimensions: {img.width} x {img.height}")
else:
    print("No image returned by Gemini.")
    print("Full response (truncated):")
    print(json.dumps(result, indent=2)[:2000])
