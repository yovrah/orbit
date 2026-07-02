import io

import win32gui
import win32ui
from PIL import Image

ICON_SIZE = 64


def extract_icon_png(exe_path: str, size: int = ICON_SIZE) -> bytes:
    """Extracts the first icon embedded in a Windows executable as a PNG.

    Reads the icon's own 32bpp ARGB bitmap via GetIconInfo instead of
    rendering onto a DC, so real transparency is preserved.
    """
    large, small = win32gui.ExtractIconEx(exe_path, 0, 1)
    icons = large or small
    if not icons:
        raise ValueError(f"No icon found in {exe_path}")
    hicon = icons[0]

    try:
        _, _, _, hbm_mask, hbm_color = win32gui.GetIconInfo(hicon)
        try:
            bmp = win32ui.CreateBitmapFromHandle(hbm_color)
            bmpinfo = bmp.GetInfo()
            bmpbits = bmp.GetBitmapBits(True)
            img = Image.frombuffer(
                "RGBA",
                (bmpinfo["bmWidth"], bmpinfo["bmHeight"]),
                bmpbits,
                "raw",
                "BGRA",
                0,
                1,
            ).copy()
        finally:
            win32gui.DeleteObject(hbm_color)
            win32gui.DeleteObject(hbm_mask)
    finally:
        for h in large:
            win32gui.DestroyIcon(h)
        for h in small:
            win32gui.DestroyIcon(h)

    if size and img.size != (size, size):
        img = img.resize((size, size), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
