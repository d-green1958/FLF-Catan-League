"""Renders the Arrakis sandworm (assets/arrakis/sandworm.webp).

Not part of the site's build: run it once, by hand, if the worm ever needs redrawing.
    python3 scripts/render-sandworm.py

The body is a lit, segmented cylinder rearing up and leaning slightly, its skin textured with the real
Martian dune photograph (assets/arrakis/slipface.jpg). The top is an open mouth: a thick lip of plates and
rings of crystal teeth around a dark throat. Haze thickens towards the base, as dust would.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'arrakis')
SCALE = 2  # render at twice the size, then shrink, for smooth edges
W, H = 900 * SCALE, 1400 * SCALE
TOP = 300 * SCALE  # centre of the mouth

rng = np.random.default_rng(7)


def centre_x(y):
    t = (H - y) / (H - TOP)  # 0 at the base, 1 at the mouth
    return W / 2 + (70 * math.sin(t * math.pi * 0.9) - 90 * t) * SCALE


def radius(y):
    t = (y - TOP) / (H - TOP)  # 0 at the mouth, 1 at the base
    return (235 + 85 * t) * SCALE


# The sand texture, from the real photograph.
sand = np.asarray(Image.open(os.path.join(ASSETS, 'slipface.jpg')).convert('RGB'), dtype=np.float32) / 255
sand = sand[: int(sand.shape[0] * 0.6)]  # only the clean sand, none of the rocks at the foot of the dune
sand = np.concatenate([sand, sand[::-1]])  # mirrored, so the texture tiles without a seam
sand_h, sand_w, _ = sand.shape

img = np.zeros((H, W, 4), dtype=np.float32)
# Backlit by the low sun behind and to the right: a darker body with a bright rim.
light = np.array([-0.3, -0.45, 0.5])
light /= np.linalg.norm(light)
base_colour = np.array([0.40, 0.29, 0.19])
haze_colour = np.array([0.93, 0.78, 0.56])
grain = gaussian_filter(rng.standard_normal((H, W)), 1.2) * 0.06
blotches = gaussian_filter(rng.standard_normal((H // 8, W // 8)), 3)
blotches = np.kron(blotches, np.ones((8, 8)))[:H, :W] * 0.25
# Fine wrinkles running round the body, and a slow wobble so the plate edges are never quite straight.
wrinkles = gaussian_filter(rng.standard_normal((H, W)), (1.0, 9)) * 0.9
wobble = gaussian_filter(rng.standard_normal((H // 4, W // 4)), 6)
wobble = np.kron(wobble, np.ones((4, 4)))[:H, :W] * 1.6
# Segments of uneven length: the phase climbs at a rate that drifts up and down the body.
drift = gaussian_filter(rng.standard_normal(H), 22)
spacing = 46 * SCALE * (1 + 0.38 * drift / drift.std())
spacing = np.clip(spacing, 26 * SCALE, 78 * SCALE)
row_phase = np.cumsum(1 / spacing)

# The body, row by row.
for y in range(TOP, H):
    c = centre_x(y)
    r0 = radius(y)
    # Each plate overhangs the next a little, so the outline is scalloped rather than smooth.
    edge_f = row_phase[y] - math.floor(row_phase[y])
    r = r0 * (1 + 0.022 * math.exp(-((edge_f - 0.18) / 0.22) ** 2) - 0.014 * math.exp(-((edge_f - 0.03) / 0.08) ** 2))
    x0, x1 = int(max(0, c - r)), int(min(W, c + r))
    xs = np.arange(x0, x1)
    u = (xs - c) / r
    u = np.clip(u, -0.999, 0.999)
    nz = np.sqrt(1 - u * u)
    # Ring segments, curving with the body as rings on a cylinder seen from slightly above, with wobbly edges.
    phase = row_phase[y] - 0.16 * r * nz / spacing[y] + wobble[y, x0:x1] * 0.05
    f = phase - np.floor(phase)
    groove = np.exp(-((f - 0.04) / 0.05) ** 2)       # the dark joint between plates
    lip = np.exp(-((f - 0.13) / 0.06) ** 2)          # the raised edge just below it
    belly = 0.85 + 0.15 * np.sin(f * math.pi)        # each plate bulges a little
    normal = np.stack([u, -0.35 * lip + 0.25 * groove, nz], axis=1)
    normal /= np.linalg.norm(normal, axis=1, keepdims=True)
    diffuse = np.clip(normal @ light, 0, 1)
    shade = 0.2 + 0.7 * diffuse
    shade *= belly * (1 - 0.65 * groove) * (1 + 0.18 * lip) * (1 + 0.07 * wrinkles[y, x0:x1])
    shade = shade ** 1.15
    # Skin: the photographed sand, wrapped round the body, mixed with a darker, leathery base.
    tx = ((np.arcsin(u) / math.pi + 0.5) * sand_w * 0.7 + 200).astype(int) % sand_w
    ty = int((y * 0.7) % sand_h)
    texture = sand[ty, tx]
    albedo = texture * 0.55 + base_colour * 0.45
    albedo *= (1 + grain[y, x0:x1] + blotches[y, x0:x1])[:, None]
    colour = albedo * shade[:, None]
    # Sand caught in the joints between plates.
    colour = colour * (1 - 0.32 * groove[:, None]) + np.array([0.78, 0.6, 0.4]) * 0.32 * groove[:, None] * (0.6 + 0.4 * nz[:, None])
    # Warm rim light from the low sun behind, on the right-hand edge.
    rim = np.clip(u, 0, 1) ** 1.6 * (1 - nz) ** 0.8
    colour += rim[:, None] * np.array([1.0, 0.82, 0.55]) * 1.3
    # Dust and distance: more haze towards the base.
    t = (y - TOP) / (H - TOP)
    haze = 0.1 + 0.45 * t ** 1.7
    colour = colour * (1 - haze) + haze_colour * haze
    img[y, x0:x1, :3] = np.clip(colour, 0, 1)
    img[y, x0:x1, 3] = 1

# The mouth, seen from slightly above: an ellipse cut across the top of the body.
cx, rx = centre_x(TOP), radius(TOP)
ry = rx * 0.42
yy, xx = np.mgrid[0:H, 0:W]
ex = (xx - cx) / rx
ey = (yy - TOP) / ry
d = np.sqrt(ex ** 2 + ey ** 2)
outer = d <= 1.0
inner = d <= 0.8
# The thick lip: plates around the rim, lit from the upper left.
lip_zone = outer & ~inner
angle = np.arctan2(ey, ex)
plates = 0.62 + 0.38 * np.cos(angle * 22 + 0.4 * np.sin(angle * 5)) ** 2
lip_light = 0.55 + 0.45 * np.clip(-np.cos(angle - 0.9), 0, 1)
lip_colour = np.stack([0.5, 0.37, 0.25], axis=0)[None, None, :] * (plates * lip_light)[..., None]
img[lip_zone, :3] = np.clip(lip_colour[lip_zone] * 0.9 + 0.06, 0, 1)
img[lip_zone, 3] = 1
# The throat: dark, deepening towards a point below the centre.
throat_d = np.sqrt(ex ** 2 + ((yy - TOP - ry * 0.22) / ry) ** 2)
depth = np.clip(throat_d / 0.8, 0, 1)
throat = np.stack([0.24, 0.14, 0.07])[None, None, :] * (depth ** 1.6)[..., None]
img[inner, :3] = throat[inner]
img[inner, 3] = 1

worm = Image.fromarray((img * 255).astype(np.uint8), 'RGBA')

# Two staggered rings of curved crystal teeth just inside the lip, uneven in length, hooking in towards
# the throat; the inner ring sits deeper, in shadow.
teeth = Image.new('RGBA', (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(teeth)
for ring, count, length, width, tone in [(0.79, 46, 0.17, 0.034, 1.0), (0.66, 38, 0.14, 0.03, 0.62)]:
    offset = rng.uniform(0, 1)
    for i in range(count):
        a = (i + offset + rng.uniform(-0.25, 0.25)) / count * 2 * math.pi
        size = length * rng.uniform(0.6, 1.4)
        hook = rng.uniform(0.04, 0.09)
        bx, by = cx + math.cos(a) * rx * ring, TOP + math.sin(a) * ry * ring
        mid_r, tip_r = ring - size * 0.55, ring - size
        mx = cx + math.cos(a + hook * 0.5) * rx * mid_r
        my = TOP + math.sin(a + hook * 0.5) * ry * mid_r
        tx = cx + math.cos(a + hook) * rx * tip_r
        ty = TOP + math.sin(a + hook) * ry * tip_r
        px, py = -math.sin(a) * rx * width, math.cos(a) * ry * width
        lit = 0.5 + 0.5 * max(0, -math.cos(a - 0.9))
        shade = tone * lit
        colour = (int(232 * shade), int(222 * shade), int(196 * shade), 255)
        draw.polygon([(bx + px, by + py), (mx + px * 0.5, my + py * 0.5), (tx, ty), (mx - px * 0.5, my - py * 0.5), (bx - px, by - py)], fill=colour)
worm = Image.alpha_composite(worm, teeth.filter(ImageFilter.GaussianBlur(0.7 * SCALE)))

# Sand pouring from the rim of the mouth in a few soft, wavering falls, and a spray of grains around it.
streams = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(streams)
for i in range(12):
    a = rng.uniform(0.25, math.pi - 0.25)  # the near (lower) half of the rim
    sx, sy = cx + math.cos(a) * rx * rng.uniform(0.92, 1.0), TOP + math.sin(a) * ry
    length = rng.uniform(0.3, 0.7) * (H - TOP)
    width = rng.uniform(8, 18) * SCALE
    sway = rng.uniform(8, 22) * SCALE
    wave = rng.uniform(2, 4)
    points = [(sx + math.sin(t * wave + i) * sway * t, sy + t * length) for t in np.linspace(0, 1, 50)]
    for k in range(len(points) - 1):
        t = k / len(points)
        sd.line([points[k], points[k + 1]], fill=(222, 178, 118, int(110 * (1 - t) ** 1.5)), width=int(width * (1 + 0.8 * t)))
for i in range(700):
    px, py = cx + rng.normal(0, rx * 0.75), TOP + abs(rng.normal(0, ry * 2.4))
    rad = rng.uniform(1, 3) * SCALE
    sd.ellipse([px - rad, py - rad, px + rad, py + rad], fill=(232, 192, 134, int(rng.uniform(40, 150))))
worm = Image.alpha_composite(worm, streams.filter(ImageFilter.GaussianBlur(3.5 * SCALE)))

# A veil of dust over the lower body, thickest at the base.
veil = np.zeros((H, W, 4), dtype=np.float32)
clouds = gaussian_filter(rng.standard_normal((H // 6, W // 6)), 7)
clouds = np.kron(clouds, np.ones((6, 6)))[:H, :W]
clouds = np.pad(clouds, ((0, H - clouds.shape[0]), (0, W - clouds.shape[1])), mode='edge')
clouds = (clouds - clouds.min()) / (clouds.max() - clouds.min())
rows = np.clip((np.arange(H) - (TOP + 0.35 * (H - TOP))) / (0.65 * (H - TOP)), 0, 1)[:, None]
body_alpha = np.asarray(worm)[..., 3] / 255
veil[..., :3] = np.array([0.9, 0.74, 0.52])
veil[..., 3] = np.clip(rows * (0.35 + 0.55 * clouds), 0, 0.92) * np.maximum(body_alpha, rows * 0.8)
worm = Image.alpha_composite(worm, Image.fromarray((veil * 255).astype(np.uint8), 'RGBA'))

# A little overall softness, as seen through heat haze, then shrink to size.
worm = worm.filter(ImageFilter.GaussianBlur(0.8 * SCALE)).resize((W // SCALE, H // SCALE), Image.LANCZOS)
out = os.path.join(ASSETS, 'sandworm.webp')
worm.save(out, 'WEBP', quality=88, method=6)
print(out, worm.size, os.path.getsize(out) // 1024, 'KB')
