#!/usr/bin/env python3
"""Generate a macOS .icns icon for Work Dashboard."""

import os, shutil, subprocess
from PIL import Image, ImageDraw

PANEL_COLORS = [
    (59, 130, 246),   # blue   — My Work
    (139, 92, 246),   # violet — Team Pulse
    (20, 184, 166),   # teal   — Replatform
    (239, 68, 68),    # red    — Meetings
]
BG = (15, 23, 42)


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded background
    bg_r = max(2, round(size * 0.18))
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=bg_r, fill=(*BG, 255))

    # 2x2 panel grid
    pad  = round(size * 0.12)
    gap  = round(size * 0.055)
    cell = (size - 2 * pad - gap) // 2
    cr   = max(2, round(cell * 0.2))

    positions = [
        (pad,              pad),
        (pad + cell + gap, pad),
        (pad,              pad + cell + gap),
        (pad + cell + gap, pad + cell + gap),
    ]

    for (x, y), color in zip(positions, PANEL_COLORS):
        # Slight top-highlight for depth
        hi = tuple(min(255, int(c + (255 - c) * 0.25)) for c in color)

        cell_img = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
        cd = ImageDraw.Draw(cell_img)
        cd.rounded_rectangle([0, 0, cell - 1, cell - 1], radius=cr, fill=(*color, 255))
        # Top highlight strip
        cd.rounded_rectangle([0, 0, cell - 1, cell // 3], radius=cr, fill=(*hi, 80))

        img.paste(cell_img, (x, y), cell_img)

    return img


ICONSET_MAP = [
    (16,   "icon_16x16.png"),
    (32,   "icon_16x16@2x.png"),
    (32,   "icon_32x32.png"),
    (64,   "icon_32x32@2x.png"),
    (128,  "icon_128x128.png"),
    (256,  "icon_128x128@2x.png"),
    (256,  "icon_256x256.png"),
    (512,  "icon_256x256@2x.png"),
    (512,  "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]


def main():
    out = "/tmp/WorkDashboard.iconset"
    os.makedirs(out, exist_ok=True)

    rendered = {}
    for sz, name in ICONSET_MAP:
        if sz not in rendered:
            rendered[sz] = make_icon(sz)
        rendered[sz].save(os.path.join(out, name))
        print(f"  {sz}x{sz} → {name}")

    icns = "/tmp/WorkDashboard.icns"
    subprocess.run(["iconutil", "-c", "icns", out, "-o", icns], check=True)
    print(f"\nGenerated: {icns}")

    # Install into the live app bundle
    app_res = "/Applications/Work Dashboard.app/Contents/Resources"
    shutil.copy2(icns, os.path.join(app_res, "app-icon.icns"))
    print("Installed into app bundle")

    # Save to source tree so future builds include it
    src_icons = "/Users/vdauer/work-dashboard/src-tauri/icons"
    os.makedirs(src_icons, exist_ok=True)
    shutil.copy2(icns, os.path.join(src_icons, "icon.icns"))

    # Save individual PNGs for Tauri (it needs a 32x32 and 128x128 at minimum)
    for sz, name in ICONSET_MAP:
        rendered[sz].save(os.path.join(src_icons, name))
    print(f"Saved to source: {src_icons}/")

    # Refresh Dock icon cache
    subprocess.run(["touch", "/Applications/Work Dashboard.app/Contents/Info.plist"])
    subprocess.run(["killall", "Dock"])
    print("\nDock restarted — icon should appear shortly.")


if __name__ == "__main__":
    main()
