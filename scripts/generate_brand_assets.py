"""
Generate all Marshell brand assets from the master 4K presentation image.

Outputs:
1. UI Assets:
   - public/main_logo.png (1024x1024 white mark on transparent)
   - public/main_logo_light.png (1024x1024 dark mark on transparent)
   - public/main_logo_256.webp & main_logo_512.webp
   - public/main_logo_light_256.webp & main_logo_light_512.webp
   - .github/assets/logo.png & logo-panel.png
   - .github/assets/logo-dark.svg & logo-light.svg
   - public/favicon.ico & src/app/favicon.ico

2. OS Packaging Icons:
   - src-tauri/icons/icon.png (512x512)
   - src-tauri/icons/{16x16, 32x32, 48x48, 64x64, 128x128, 128x128@2x, 256x256, 512x512}.png
   - src-tauri/icons/AppIcon{16..1024}.png
   - src-tauri/icons/Square*Logo.png & StoreLogo.png
   - src-tauri/icons/icon.ico (16, 24, 32, 48, 64, 128, 256)
   - src-tauri/icons/icon.icns
   - Android mipmaps & iOS xcassets
"""

import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SOURCE_4K = r"C:\Users\Mr-A\Downloads\Marshell_Logo_4K.png"

def isolate_symbol_masters(source_path):
    print(f"Reading 4K source from {source_path}...")
    img = Image.open(source_path).convert("RGB")
    arr = np.array(img, dtype=np.float32)

    # Compute luminance
    lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    # Clean alpha: background is <= 1.0, symbol core is >= 250.0
    alpha = np.clip((lum - 2.0) / (250.0 - 2.0), 0.0, 1.0) * 255.0

    # Build pure white RGBA
    h, w = arr.shape[:2]
    white_rgba = np.zeros((h, w, 4), dtype=np.uint8)
    white_rgba[:, :, 0] = 255
    white_rgba[:, :, 1] = 255
    white_rgba[:, :, 2] = 255
    white_rgba[:, :, 3] = alpha.astype(np.uint8)

    # Crop tightly to non-zero alpha bounding box
    mask = white_rgba[:, :, 3] > 0
    y_idx, x_idx = np.where(mask)
    ymin, ymax = y_idx.min(), y_idx.max()
    xmin, xmax = x_idx.min(), x_idx.max()

    tight_white = Image.fromarray(white_rgba[ymin:ymax+1, xmin:xmax+1])
    print(f"Isolated white symbol master: {tight_white.size[0]}x{tight_white.size[1]} px")

    # Build dark monochrome RGBA (#0A0A0C, rgb 10, 10, 12)
    dark_rgba = np.zeros((h, w, 4), dtype=np.uint8)
    dark_rgba[:, :, 0] = 10
    dark_rgba[:, :, 1] = 10
    dark_rgba[:, :, 2] = 12
    dark_rgba[:, :, 3] = alpha.astype(np.uint8)

    tight_dark = Image.fromarray(dark_rgba[ymin:ymax+1, xmin:xmax+1])
    print(f"Isolated dark symbol master: {tight_dark.size[0]}x{tight_dark.size[1]} px")

    return tight_white, tight_dark


def generate_ui_logo(symbol_master, canvas_size=1024, fill_ratio=0.84):
    """
    Creates a square canvas with the symbol centered at fill_ratio of width.
    Preserves exact aspect ratio and sharp anti-aliasing.
    """
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    target_w = int(round(canvas_size * fill_ratio))
    scale = target_w / symbol_master.width
    target_h = int(round(symbol_master.height * scale))

    scaled = symbol_master.resize((target_w, target_h), Image.Resampling.LANCZOS)
    ox = (canvas_size - target_w) // 2
    oy = (canvas_size - target_h) // 2

    canvas.paste(scaled, (ox, oy), scaled)
    return canvas


def generate_svg_markup(source_path, fill_color="#FFFFFF"):
    """
    Generates clean, precise SVG vector paths matching the 4K contour.
    """
    im = cv2.imread(source_path, cv2.IMREAD_GRAYSCALE)
    _, thresh = cv2.threshold(im, 127, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cnt = max(contours, key=cv2.contourArea)

    # 1.8 px epsilon at 4K yields 25 precise corner vertices
    approx = cv2.approxPolyDP(cnt, 1.8, True)[:, 0, :]
    pts = approx.astype(float)

    xmin, xmax = pts[:, 0].min(), pts[:, 0].max()
    ymin, ymax = pts[:, 1].min(), pts[:, 1].max()
    w = xmax - xmin
    h = ymax - ymin

    # Center in 256x256 viewBox with 84% width
    target_w = 215.0
    scale = target_w / w
    target_h = h * scale
    ox = (256.0 - target_w) / 2.0
    oy = (256.0 - target_h) / 2.0

    norm_pts = []
    for p in pts:
        nx = (p[0] - xmin) * scale + ox
        ny = (p[1] - ymin) * scale + oy
        norm_pts.append((round(nx, 2), round(ny, 2)))

    path_d = f"M {norm_pts[0][0]},{norm_pts[0][1]} " + " ".join(f"L {p[0]},{p[1]}" for p in norm_pts[1:]) + " Z"

    svg = f"""<svg
  fill="none"
  height="256"
  viewBox="0 0 256 256"
  width="256"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="{path_d}"
    fill="{fill_color}"
  />
</svg>
"""
    return svg


def generate_os_master_icon(white_symbol_master, canvas_size=1024, fill_ratio=0.86):
    """
    Creates the standalone transparent OS icon (no background).
    Pure transparent background (RGBA 0,0,0,0) with the white mark centered.
    """
    return generate_ui_logo(white_symbol_master, canvas_size=canvas_size, fill_ratio=fill_ratio)


def generate_ico(os_master, ico_path):
    """
    Generate Windows .ico file with all standard sizes:
    16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256
    Sharpen the smallest sizes so tips stay distinct at low resolutions.
    """
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = []
    for s in sizes:
        resized = os_master.resize((s, s), Image.Resampling.LANCZOS)
        if s <= 32:
            # Subtle unsharp mask to crisp up low-res tips
            resized = resized.filter(ImageFilter.UnsharpMask(radius=1.0, percent=120, threshold=2))
        images.append(resized)

    # Pillow saves ICO with sizes from images
    images[0].save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[1:],
    )
    print(f"Saved multi-size Windows ICO to {ico_path} ({sizes})")


def generate_icns(os_master, icns_path):
    """
    Generate macOS .icns file supporting standard resolutions.
    """
    os_master.save(icns_path, format="ICNS")
    print(f"Saved macOS ICNS to {icns_path}")


def main():
    white_master, dark_master = isolate_symbol_masters(SOURCE_4K)

    # 1. UI Brands
    print("\n--- Generating Application UI Brand Marks ---")
    ui_dark = generate_ui_logo(white_master, canvas_size=1024, fill_ratio=0.84)
    ui_light = generate_ui_logo(dark_master, canvas_size=1024, fill_ratio=0.84)

    # Save public/ logos
    ui_dark.save("public/main_logo.png", format="PNG")
    ui_light.save("public/main_logo_light.png", format="PNG")
    print("Saved public/main_logo.png and public/main_logo_light.png")

    # Save WebP variants
    ui_dark.resize((512, 512), Image.Resampling.LANCZOS).save("public/main_logo_512.webp", format="WEBP", quality=95)
    ui_dark.resize((256, 256), Image.Resampling.LANCZOS).save("public/main_logo_256.webp", format="WEBP", quality=95)
    ui_light.resize((512, 512), Image.Resampling.LANCZOS).save("public/main_logo_light_512.webp", format="WEBP", quality=95)
    ui_light.resize((256, 256), Image.Resampling.LANCZOS).save("public/main_logo_light_256.webp", format="WEBP", quality=95)
    print("Saved public/ WebP variants (256, 512)")

    # Save .github/assets/
    ui_dark.save(".github/assets/logo.png", format="PNG")
    ui_dark.save(".github/assets/logo-panel.png", format="PNG")

    svg_dark = generate_svg_markup(SOURCE_4K, fill_color="#FFFFFF")
    with open(".github/assets/logo-dark.svg", "w", encoding="utf-8") as f:
        f.write(svg_dark)

    svg_light = generate_svg_markup(SOURCE_4K, fill_color="#0A0A0C")
    with open(".github/assets/logo-light.svg", "w", encoding="utf-8") as f:
        f.write(svg_light)
    print("Saved .github/assets/ (logo.png, logo-panel.png, logo-dark.svg, logo-light.svg)")

    # 2. OS Icons
    print("\n--- Generating OS and Packaging Icons ---")
    os_master = generate_os_master_icon(white_master, canvas_size=1024)

    # Tauri standard png sizes
    os_sizes = {
        "16x16.png": 16,
        "32x32.png": 32,
        "48x48.png": 48,
        "64x64.png": 64,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "256x256.png": 256,
        "512x512.png": 512,
        "icon.png": 512,
        "AppIcon16.png": 16,
        "AppIcon32.png": 32,
        "AppIcon48.png": 48,
        "AppIcon64.png": 64,
        "AppIcon128.png": 128,
        "AppIcon256.png": 256,
        "AppIcon512.png": 512,
        "AppIcon1024.png": 1024,
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }

    os.makedirs("src-tauri/icons", exist_ok=True)
    for filename, sz in os_sizes.items():
        out_path = os.path.join("src-tauri/icons", filename)
        resized = os_master.resize((sz, sz), Image.Resampling.LANCZOS)
        if sz <= 32:
            resized = resized.filter(ImageFilter.UnsharpMask(radius=1.0, percent=120, threshold=2))
        resized.save(out_path, format="PNG")

    print(f"Generated {len(os_sizes)} PNG icons in src-tauri/icons/")

    # Generate icon.ico and icon.icns
    generate_ico(os_master, "src-tauri/icons/icon.ico")
    generate_icns(os_master, "src-tauri/icons/icon.icns")

    # Generate favicons
    generate_ico(os_master, "public/favicon.ico")
    generate_ico(os_master, "src/app/favicon.ico")
    print("Saved public/favicon.ico and src/app/favicon.ico")

    # 3. Android mipmaps
    android_res_base = "src-tauri/gen/android/app/src/main/res"
    if os.path.exists(android_res_base):
        print("\n--- Updating Android Mipmaps ---")
        densities = {
            "mipmap-mdpi": (48, 108),
            "mipmap-hdpi": (72, 162),
            "mipmap-xhdpi": (96, 216),
            "mipmap-xxhdpi": (144, 324),
            "mipmap-xxxhdpi": (192, 432),
        }
        for density, (icon_sz, adaptive_sz) in densities.items():
            folder = os.path.join(android_res_base, density)
            os.makedirs(folder, exist_ok=True)

            # Launcher & round
            launcher_img = os_master.resize((icon_sz, icon_sz), Image.Resampling.LANCZOS)
            launcher_img.save(os.path.join(folder, "ic_launcher.png"), format="PNG")
            launcher_img.save(os.path.join(folder, "ic_launcher_round.png"), format="PNG")

            # Adaptive background (transparent)
            bg_img = Image.new("RGBA", (adaptive_sz, adaptive_sz), (0, 0, 0, 0))
            bg_img.save(os.path.join(folder, "ic_launcher_background.png"), format="PNG")

            # Adaptive foreground (white mark centered at 66%)
            fg_img = Image.new("RGBA", (adaptive_sz, adaptive_sz), (0, 0, 0, 0))
            sym_w = int(round(adaptive_sz * 0.66))
            scale = sym_w / white_master.width
            sym_h = int(round(white_master.height * scale))
            scaled_sym = white_master.resize((sym_w, sym_h), Image.Resampling.LANCZOS)
            fg_img.paste(scaled_sym, ((adaptive_sz - sym_w) // 2, (adaptive_sz - sym_h) // 2), scaled_sym)
            fg_img.save(os.path.join(folder, "ic_launcher_foreground.png"), format="PNG")
            fg_img.save(os.path.join(folder, "ic_launcher_monochrome.png"), format="PNG")
        print("Updated Android mipmaps across mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi")

    # 4. Apple xcassets
    apple_res_base = "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset"
    if os.path.exists(apple_res_base):
        print("\n--- Updating iOS/macOS xcassets ---")
        for f in os.listdir(apple_res_base):
            if f.endswith(".png"):
                p = os.path.join(apple_res_base, f)
                with Image.open(p) as cur:
                    sz = cur.size
                resized = os_master.resize(sz, Image.Resampling.LANCZOS)
                resized.save(p, format="PNG")
        print("Updated all AppIcon-*.png in Assets.xcassets")

    print("\n[SUCCESS] Brand asset generation complete!")

if __name__ == "__main__":
    main()
