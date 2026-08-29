from pathlib import Path
import math
import random

from PIL import Image, ImageDraw


W, H = 960, 540
S = 2
OUT = Path(__file__).resolve().parents[1] / "img" / "map-previews"
DESERT_SOURCE = Path(r"C:\Users\joaog\.codex\generated_images\019f8204-64aa-7c63-a818-d371c360eb07\exec-1c6236e2-014d-455f-bc28-2b9e852c3d30.png")


def pxy(point):
    return tuple(int(v * S) for v in point)


def points(values):
    return [pxy(value) for value in values]


def polygon(draw, values, fill):
    draw.polygon(points(values), fill=fill)


def line(draw, values, fill, width=2, joint="curve"):
    draw.line(points(values), fill=fill, width=max(1, int(width * S)), joint=joint)


def ellipse(draw, box, fill, outline=None, width=1):
    scaled = tuple(int(v * S) for v in box)
    draw.ellipse(scaled, fill=fill, outline=outline, width=max(1, int(width * S)))


def irregular_blob(cx, cy, rx, ry, seed, vertices=18):
    rng = random.Random(seed)
    result = []
    for i in range(vertices):
        angle = math.tau * i / vertices
        amount = 0.82 + rng.random() * 0.24
        result.append((cx + math.cos(angle) * rx * amount, cy + math.sin(angle) * ry * amount))
    return result


def ground_texture(image, top, palette, seed):
    rng = random.Random(seed)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(16):
        y = rng.randint(top + 8, H - 12)
        x = rng.randint(-100, W - 120)
        length = rng.randint(130, 330)
        height = rng.randint(8, 20)
        color = rng.choice(palette)
        polygon(draw, [
            (x, y),
            (x + length * 0.35, y - rng.randint(1, 5)),
            (x + length, y + rng.randint(-2, 5)),
            (x + length * 0.75, y + height),
            (x + length * 0.18, y + height + rng.randint(-3, 3)),
        ], color)
    image.alpha_composite(overlay)


def rock(draw, x, y, size, base, shade, ink):
    shape = [
        (x - size, y),
        (x - size * 0.78, y - size * 0.46),
        (x - size * 0.28, y - size * 0.78),
        (x + size * 0.42, y - size * 0.64),
        (x + size, y - size * 0.18),
        (x + size * 0.82, y),
    ]
    polygon(draw, shape, base)
    polygon(draw, [shape[2], shape[3], shape[4], (x + size * 0.3, y - size * 0.12)], shade)
    line(draw, shape[:5], ink, 1.6)
    line(draw, [(x - size * 0.28, y - size * 0.78), (x + size * 0.08, y - size * 0.22)], ink, 1.0)


def grass(draw, x, y, height, color, ink, seed):
    rng = random.Random(seed)
    blades = rng.randint(4, 7)
    for i in range(blades):
        ox = (i - (blades - 1) / 2) * rng.uniform(3.0, 5.0)
        bend = rng.uniform(-8, 8)
        h = height * rng.uniform(0.62, 1.08)
        line(draw, [(x + ox, y), (x + ox + bend * 0.35, y - h * 0.58), (x + ox + bend, y - h)], color, rng.uniform(1.3, 2.1))
    line(draw, [(x - 15, y + 1), (x + 14, y + 1)], ink, 1.0)


def mushroom(draw, x, y, scale, cap, stem, ink):
    polygon(draw, [
        (x - 4 * scale, y),
        (x - 3.2 * scale, y - 11 * scale),
        (x + 2.8 * scale, y - 11 * scale),
        (x + 4 * scale, y),
    ], stem)
    cap_shape = irregular_blob(x, y - 13 * scale, 11 * scale, 6 * scale, int(x * 7 + y), 12)
    polygon(draw, cap_shape, cap)
    line(draw, cap_shape[:8], ink, 1.15)
    ellipse(draw, (x - 4 * scale, y - 16 * scale, x - 1.5 * scale, y - 13.5 * scale), (217, 163, 117, 180))


def deciduous_tree(draw, x, y, scale, leaf, leaf_dark, trunk, ink, seed):
    trunk_shape = [
        (x - 10 * scale, y),
        (x - 6 * scale, y - 52 * scale),
        (x - 22 * scale, y - 73 * scale),
        (x - 17 * scale, y - 78 * scale),
        (x - 2 * scale, y - 60 * scale),
        (x + 6 * scale, y - 88 * scale),
        (x + 12 * scale, y - 86 * scale),
        (x + 7 * scale, y - 51 * scale),
        (x + 13 * scale, y),
    ]
    polygon(draw, trunk_shape, trunk)
    line(draw, trunk_shape[:5], ink, 1.7)
    canopy = irregular_blob(x - 2 * scale, y - 98 * scale, 48 * scale, 31 * scale, seed, 20)
    polygon(draw, canopy, leaf)
    patch = irregular_blob(x + 10 * scale, y - 91 * scale, 24 * scale, 13 * scale, seed + 1, 14)
    polygon(draw, patch, leaf_dark)
    line(draw, canopy[1:8], ink, 1.25)


def bare_tree(draw, x, y, scale, trunk, light, ink, partial=False):
    base = x - 30 * scale if partial else x
    trunk_shape = [
        (base - 10 * scale, y),
        (base - 4 * scale, y - 85 * scale),
        (base + 4 * scale, y - 87 * scale),
        (base + 11 * scale, y),
    ]
    polygon(draw, trunk_shape, trunk)
    polygon(draw, [(base - 1 * scale, y - 4 * scale), (base, y - 82 * scale), (base + 4 * scale, y - 86 * scale), (base + 6 * scale, y - 2 * scale)], light)
    branches = [
        [(base, y - 78 * scale), (base - 22 * scale, y - 105 * scale), (base - 31 * scale, y - 119 * scale)],
        [(base + 1 * scale, y - 72 * scale), (base + 29 * scale, y - 99 * scale), (base + 45 * scale, y - 105 * scale)],
        [(base, y - 88 * scale), (base + 8 * scale, y - 119 * scale)],
        [(base - 20 * scale, y - 103 * scale), (base - 37 * scale, y - 101 * scale)],
        [(base + 27 * scale, y - 97 * scale), (base + 39 * scale, y - 119 * scale)],
    ]
    for branch in branches:
        line(draw, branch, trunk, 5.0 * scale)
        line(draw, branch, ink, 1.0 * scale)
    line(draw, trunk_shape[:3], ink, 1.5)


def pine(draw, x, y, scale, green, snow, trunk, ink, seed):
    rng = random.Random(seed)
    polygon(draw, [(x - 4 * scale, y), (x - 3 * scale, y - 25 * scale), (x + 4 * scale, y - 25 * scale), (x + 5 * scale, y)], trunk)
    for level, width in ((72, 27), (53, 36), (34, 45)):
        jitter = rng.uniform(-3, 3)
        shape = [
            (x + jitter, y - level * scale),
            (x - width * scale, y - (level - 31) * scale),
            (x - 9 * scale, y - (level - 25) * scale),
            (x - (width + 5) * scale, y - (level - 40) * scale),
            (x + (width + 2) * scale, y - (level - 40) * scale),
            (x + 10 * scale, y - (level - 25) * scale),
            (x + width * scale, y - (level - 31) * scale),
        ]
        polygon(draw, shape, green)
        line(draw, shape[:3], ink, 1.05)
        polygon(draw, [shape[0], shape[1], (x - 6 * scale, y - (level - 19) * scale), (x + 9 * scale, y - (level - 23) * scale), shape[-1]], snow)


def flower(draw, x, y, scale, petal, center, ink, lean=0):
    line(draw, [(x, y), (x + lean, y - 17 * scale)], (58, 105, 54, 255), 1.3)
    cx, cy = x + lean, y - 20 * scale
    for angle in range(0, 360, 72):
        a = math.radians(angle)
        px = cx + math.cos(a) * 5 * scale
        py = cy + math.sin(a) * 5 * scale
        ellipse(draw, (px - 4 * scale, py - 3 * scale, px + 4 * scale, py + 3 * scale), petal, ink, 0.7)
    ellipse(draw, (cx - 2.5 * scale, cy - 2.5 * scale, cx + 2.5 * scale, cy + 2.5 * scale), center)


def save(image, name):
    OUT.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").resize((W, H), Image.Resampling.LANCZOS).save(OUT / name, quality=95)


def make_desert():
    source = Image.open(DESERT_SOURCE).convert("RGB")
    source.resize((W, H), Image.Resampling.LANCZOS).save(OUT / "desert.png", quality=95)


def make_snow():
    image = Image.new("RGBA", (W * S, H * S), (145, 177, 202, 255))
    draw = ImageDraw.Draw(image, "RGBA")
    polygon(draw, [(0, 245), (150, 226), (320, 239), (510, 218), (730, 242), (960, 230), (960, 540), (0, 540)], (223, 234, 242, 255))
    polygon(draw, [(0, 285), (180, 274), (360, 292), (590, 268), (790, 284), (960, 275), (960, 540), (0, 540)], (241, 246, 249, 255))
    ground_texture(image, 270, [(183, 205, 222, 22), (145, 180, 206, 18)], 21)
    draw = ImageDraw.Draw(image, "RGBA")
    pond = [(72, 540), (92, 476), (156, 428), (249, 402), (365, 411), (469, 453), (522, 510), (530, 540)]
    polygon(draw, pond, (160, 203, 225, 255))
    line(draw, pond[1:6], (91, 125, 154, 235), 1.6)
    pine(draw, 590, 333, 0.82, (74, 111, 98, 255), (229, 239, 244, 255), (91, 66, 48, 255), (67, 78, 82, 220), 2)
    pine(draw, 646, 344, 0.62, (65, 102, 91, 255), (235, 242, 246, 255), (91, 66, 48, 255), (67, 78, 82, 220), 3)
    pine(draw, 694, 339, 0.72, (80, 119, 103, 255), (224, 235, 241, 255), (91, 66, 48, 255), (67, 78, 82, 220), 4)
    rock(draw, 835, 412, 38, (132, 157, 179, 255), (103, 128, 151, 255), (71, 91, 109, 220))
    # Snowman sits near the pond instead of acting as the central subject.
    ellipse(draw, (340, 366, 382, 414), (239, 245, 248, 255), (100, 115, 128, 220), 1.4)
    ellipse(draw, (347, 336, 376, 367), (247, 250, 252, 255), (100, 115, 128, 220), 1.2)
    ellipse(draw, (354, 347, 358, 351), (72, 82, 91, 255))
    ellipse(draw, (365, 347, 369, 351), (72, 82, 91, 255))
    polygon(draw, [(361, 353), (374, 356), (361, 358)], (204, 102, 38, 255))
    save(image, "snow.png")


def make_swamp():
    image = Image.new("RGBA", (W * S, H * S), (124, 151, 164, 255))
    draw = ImageDraw.Draw(image, "RGBA")
    polygon(draw, [(0, 218), (190, 225), (374, 214), (568, 229), (750, 211), (960, 226), (960, 540), (0, 540)], (116, 105, 61, 255))
    polygon(draw, [(0, 257), (180, 246), (390, 264), (640, 248), (960, 266), (960, 540), (0, 540)], (126, 119, 71, 255))
    ground_texture(image, 250, [(74, 90, 47, 26), (157, 143, 78, 20)], 31)
    draw = ImageDraw.Draw(image, "RGBA")
    channel = [(960, 306), (850, 292), (744, 305), (650, 331), (590, 365), (526, 385), (458, 379), (392, 358), (336, 367), (301, 410), (318, 452), (389, 479), (468, 500), (514, 540), (806, 540), (758, 501), (671, 474), (611, 446), (594, 417), (621, 392), (695, 369), (789, 355), (884, 361), (960, 383)]
    polygon(draw, channel, (55, 82, 74, 255))
    line(draw, channel[:11], (45, 62, 52, 220), 1.4)
    line(draw, channel[12:], (45, 62, 52, 220), 1.4)
    bare_tree(draw, 70, 393, 1.18, (91, 63, 43, 255), (119, 82, 54, 255), (62, 45, 34, 230), partial=True)
    # Bridge follows the channel instead of sitting as a centered icon.
    bridge_left, bridge_right = 340, 493
    for i in range(7):
        x0 = bridge_left + i * 22
        polygon(draw, [(x0, 369 + i * 1.5), (x0 + 24, 365 + i * 1.5), (x0 + 27, 390 + i * 1.5), (x0 + 3, 395 + i * 1.5)], (129 + (i % 2) * 7, 91, 50, 255))
        line(draw, [(x0, 369 + i * 1.5), (x0 + 24, 365 + i * 1.5), (x0 + 27, 390 + i * 1.5)], (74, 50, 34, 230), 1.0)
    line(draw, [(bridge_left - 5, 371), (bridge_right + 26, 382)], (77, 51, 31, 230), 2.0)
    for gx, gy, gh, seed in [(225, 386, 34, 1), (277, 449, 28, 2), (564, 345, 24, 3), (689, 407, 38, 4), (857, 333, 29, 5), (770, 492, 25, 6)]:
        grass(draw, gx, gy, gh, (58, 84, 43, 255), (45, 59, 34, 200), seed)
    for mx, my, ms in [(151, 448, 1.0), (176, 459, 0.65), (206, 437, 0.78), (731, 349, 0.55), (805, 442, 0.68)]:
        mushroom(draw, mx, my, ms, (145, 59, 46, 255), (213, 193, 155, 255), (78, 47, 39, 230))
    ellipse(draw, (845, 482, 887, 500), (78, 102, 48, 255), (45, 67, 39, 210), 1.0)
    save(image, "swamp.png")


def make_fairy():
    image = Image.new("RGBA", (W * S, H * S), (157, 201, 218, 255))
    draw = ImageDraw.Draw(image, "RGBA")
    polygon(draw, [(0, 238), (160, 225), (336, 239), (535, 222), (738, 236), (960, 219), (960, 540), (0, 540)], (101, 163, 74, 255))
    polygon(draw, [(0, 282), (180, 260), (380, 276), (606, 255), (820, 275), (960, 264), (960, 540), (0, 540)], (126, 184, 83, 255))
    ground_texture(image, 260, [(85, 148, 67, 22), (161, 206, 103, 20)], 41)
    draw = ImageDraw.Draw(image, "RGBA")
    # A partial rainbow stays in the distance and does not organize the whole picture.
    rainbow_colors = [(191, 111, 128, 110), (214, 171, 91, 105), (121, 177, 105, 100), (101, 164, 194, 95), (143, 117, 181, 90)]
    for i, color in enumerate(rainbow_colors):
        box = (680 - i * 4, 74 - i * 4, 1070 + i * 7, 390 + i * 7)
        scaled_box = tuple(int(v * S) for v in box)
        draw.arc(scaled_box, 188, 277, fill=color, width=max(1, int(5 * S)))
    deciduous_tree(draw, 206, 382, 1.0, (65, 126, 69, 255), (83, 147, 76, 180), (104, 68, 42, 255), (53, 70, 45, 220), 12)
    deciduous_tree(draw, 719, 345, 0.68, (73, 137, 74, 255), (91, 157, 82, 180), (104, 68, 42, 255), (53, 70, 45, 220), 13)
    rock(draw, 826, 434, 34, (111, 91, 133, 255), (88, 71, 111, 255), (67, 58, 79, 215))
    rock(draw, 85, 477, 19, (119, 101, 140, 255), (94, 78, 117, 255), (67, 58, 79, 200))
    flower_data = [
        (394, 434, 0.76, (203, 85, 124, 255), (236, 194, 87, 255), -2),
        (433, 451, 0.58, (222, 177, 64, 255), (103, 70, 146, 255), 2),
        (468, 421, 0.72, (92, 167, 207, 255), (235, 190, 78, 255), -1),
        (514, 458, 0.52, (181, 108, 190, 255), (239, 200, 89, 255), 1),
        (555, 439, 0.63, (210, 91, 117, 255), (237, 192, 79, 255), -2),
    ]
    for args in flower_data:
        flower(draw, *args)
    save(image, "fairy.png")


def gravestone(draw, x, y, width, height, base, shade, ink, variant):
    if variant == 0:
        shape = [(x - width / 2, y), (x - width / 2, y - height * 0.7), (x - width * 0.35, y - height), (x + width * 0.28, y - height), (x + width / 2, y - height * 0.72), (x + width / 2, y)]
    elif variant == 1:
        shape = [(x - width / 2, y), (x - width * 0.42, y - height * 0.78), (x, y - height), (x + width * 0.42, y - height * 0.78), (x + width / 2, y)]
    else:
        shape = [(x - width / 2, y), (x - width / 2, y - height * 0.84), (x + width / 2, y - height * 0.84), (x + width / 2, y)]
    polygon(draw, shape, base)
    polygon(draw, [shape[-2], shape[-1], (x, y), (x + width * 0.12, y - height * 0.78)], shade)
    line(draw, shape[:-1], ink, 1.35)


def candle(draw, x, y, height):
    polygon(draw, [(x - 4, y), (x - 4, y - height), (x + 4, y - height), (x + 4, y)], (211, 198, 157, 255))
    line(draw, [(x - 4, y), (x - 4, y - height), (x + 4, y - height)], (90, 75, 60, 210), 0.8)
    ellipse(draw, (x - 3, y - height - 8, x + 3, y - height + 1), (221, 130, 45, 255), (104, 70, 40, 180), 0.7)


def make_cemetery():
    image = Image.new("RGBA", (W * S, H * S), (103, 112, 151, 255))
    draw = ImageDraw.Draw(image, "RGBA")
    polygon(draw, [(0, 228), (146, 218), (326, 235), (510, 216), (708, 232), (960, 214), (960, 540), (0, 540)], (61, 66, 87, 255))
    polygon(draw, [(0, 274), (175, 252), (360, 270), (572, 247), (784, 264), (960, 250), (960, 540), (0, 540)], (74, 79, 100, 255))
    ground_texture(image, 250, [(50, 54, 73, 24), (103, 106, 127, 19)], 51)
    draw = ImageDraw.Draw(image, "RGBA")
    # A crooked dirt path connects the scene so the stones are not displayed in a row.
    polygon(draw, [(118, 540), (210, 463), (340, 422), (476, 410), (611, 374), (650, 348), (697, 355), (646, 405), (520, 441), (389, 464), (294, 505), (249, 540)], (84, 77, 77, 180))
    gravestone(draw, 173, 420, 58, 83, (107, 110, 124, 255), (82, 85, 101, 255), (48, 47, 58, 220), 0)
    gravestone(draw, 293, 475, 39, 55, (118, 119, 130, 255), (88, 90, 105, 255), (50, 49, 60, 210), 1)
    gravestone(draw, 430, 394, 45, 67, (99, 103, 119, 255), (75, 78, 94, 255), (47, 47, 58, 220), 2)
    gravestone(draw, 735, 459, 53, 72, (111, 113, 128, 255), (82, 85, 101, 255), (48, 47, 58, 220), 1)
    gravestone(draw, 868, 377, 34, 49, (101, 104, 120, 255), (76, 79, 95, 255), (47, 47, 58, 210), 0)
    # Wooden cross is integrated among the graves instead of isolated as a showcase prop.
    polygon(draw, [(564, 417), (573, 417), (573, 338), (564, 338)], (94, 61, 42, 255))
    polygon(draw, [(541, 361), (597, 361), (597, 369), (541, 369)], (94, 61, 42, 255))
    line(draw, [(564, 417), (564, 338), (573, 338)], (52, 39, 34, 220), 1.2)
    candle(draw, 462, 437, 22)
    candle(draw, 481, 443, 15)
    candle(draw, 497, 435, 27)
    bare_tree(draw, 936, 334, 0.73, (71, 52, 43, 255), (94, 67, 52, 255), (42, 38, 40, 230), partial=False)
    save(image, "cemetery.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    make_desert()
    make_snow()
    make_swamp()
    make_fairy()
    make_cemetery()


if __name__ == "__main__":
    main()
