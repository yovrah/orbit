"""Orbit Agent tray launcher.

Runs the FastAPI server in a background thread and puts an Orbit icon in the
Windows system tray. The tray menu shows the pairing QR code window, opens the
web UI in a browser, and quits the agent cleanly. This is the intended way to
run Orbit on the PC — `start_agent.bat` and the autostart task both launch it.
"""
import os
import socket
import sys
import threading
import webbrowser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from paths import logs_dir, resource_path  # noqa: E402

# Under pythonw (and in a windowed .exe) there is no console: sys.stdout is None
# and uvicorn's log formatter crashes on isatty(). Give the process a real
# stdout by writing to the log file, no matter how we were launched.
if sys.stdout is None or sys.stderr is None:
    _log = open(os.path.join(logs_dir(), "orbit-agent.log"), "a", encoding="utf-8", buffering=1)
    sys.stdout = sys.stdout or _log
    sys.stderr = sys.stderr or _log

import main  # noqa: E402  (the FastAPI app + pairing state)

PORT = 23810

DARK_BG = "#0b0d13"
CARD_BG = "#151822"
INK = "#eef0f4"
MUTED = "#9aa3b0"
BLUE = "#3a9bff"


def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def load_logo():
    """The Orbit logo shipped with the frontend; falls back to a drawn orb so
    the tray still works on a bare API-only install."""
    from PIL import Image, ImageDraw

    candidates = [
        resource_path(os.path.join("frontend", "dist", "icons", "icon-512x512.png")),
        resource_path(os.path.join("frontend", "public", "icons", "icon-512x512.png")),
    ]
    for norm in candidates:
        if os.path.exists(norm):
            try:
                return Image.open(norm).convert("RGBA")
            except Exception:
                pass

    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((4, 4, 60, 60), fill=(0, 122, 255, 255))
    d.ellipse((20, 20, 44, 44), fill=(255, 255, 255, 255))
    return img


class QrWindow:
    """A small always-reusable tkinter window with the pairing QR code.

    tkinter must live on a single thread, so one daemon thread owns the hidden
    root for the whole process; show() just wakes it up and refreshes the QR.
    """

    def __init__(self):
        self._ready = threading.Event()
        self._root = None
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        import tkinter as tk

        self._tk = tk
        root = tk.Tk()
        self._root = root
        root.withdraw()
        root.title("Orbit — Connect your phone")
        root.configure(bg=DARK_BG)
        root.resizable(False, False)
        root.protocol("WM_DELETE_WINDOW", root.withdraw)
        try:
            from PIL import ImageTk
            self._icon_ref = ImageTk.PhotoImage(load_logo().resize((32, 32)))
            root.iconphoto(True, self._icon_ref)
        except Exception:
            pass

        card = tk.Frame(root, bg=CARD_BG, padx=28, pady=24)
        card.pack(padx=18, pady=18)

        tk.Label(card, text="Scan to connect your phone", bg=CARD_BG, fg=INK,
                 font=("Segoe UI", 14, "bold")).pack()
        tk.Label(card, text="Point the phone camera at the code — it connects automatically.",
                 bg=CARD_BG, fg=MUTED, font=("Segoe UI", 9), wraplength=280).pack(pady=(4, 12))

        self._qr_label = tk.Label(card, bg="white", bd=0)
        self._qr_label.pack()

        self._url_var = tk.StringVar(value="starting…")
        url_entry = tk.Entry(card, textvariable=self._url_var, state="readonly",
                             readonlybackground=CARD_BG, fg=BLUE, bd=0,
                             font=("Consolas", 10), justify="center", width=34)
        url_entry.pack(pady=(12, 0))

        tk.Label(card, text="Phone and PC must be on the same Wi-Fi network.",
                 bg=CARD_BG, fg=MUTED, font=("Segoe UI", 8)).pack(pady=(10, 0))

        self._ready.set()
        try:
            root.mainloop()
        except Exception as e:
            # A dying QR window must never take the server down with it.
            print(f"QR window loop ended: {e!r}")

    def _refresh_and_show(self):
        try:
            import qrcode
            from PIL import ImageTk

            pair_url = main.build_pair_url()
            img = qrcode.make(pair_url).convert("RGB").resize((260, 260))
            self._qr_ref = ImageTk.PhotoImage(img)  # keep a reference or tk drops it
            self._qr_label.configure(image=self._qr_ref)
            self._url_var.set(pair_url.split("?")[0])

            root = self._root
            root.deiconify()
            root.lift()
            root.attributes("-topmost", True)
            root.after(200, lambda: root.attributes("-topmost", False))
            root.update_idletasks()
            # center on screen
            w, h = root.winfo_width(), root.winfo_height()
            x = (root.winfo_screenwidth() - w) // 2
            y = (root.winfo_screenheight() - h) // 2
            root.geometry(f"+{x}+{y}")
        except Exception as e:
            print(f"Unable to show QR window: {e!r}")

    def show(self):
        if not self._ready.wait(5) or self._root is None:
            return
        self._root.after(0, self._refresh_and_show)

    def destroy(self):
        if self._ready.is_set() and self._root is not None:
            try:
                self._root.after(0, self._root.destroy)
            except Exception:
                pass


def run_server() -> "uvicorn.Server":
    import uvicorn

    config = uvicorn.Config(main.app, host="0.0.0.0", port=PORT, log_level="info")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()
    return server


def main_tray():
    if is_port_in_use(PORT):
        import ctypes
        ctypes.windll.user32.MessageBoxW(
            0, "Orbit Agent is already running (port 23810 is busy).\n"
               "Look for the Orbit icon in the system tray.",
            "Orbit Agent", 0x00000030 | 0x00010000)
        return

    import pystray

    server = run_server()
    qr_window = QrWindow()

    def wait_and_show_qr():
        # Wait for the server (and PAIRING_TOKEN) to come up, then greet the
        # user with the QR so first launch needs zero discovery. Once a phone
        # has paired, stay quiet on later launches — the QR is one tray click
        # away and popping a window at every logon gets old fast.
        for _ in range(100):
            if main.PAIRING_TOKEN and is_port_in_use(PORT):
                try:
                    from db import models
                    already_paired = bool(models.get_all_paired_clients())
                except Exception:
                    already_paired = False
                if not already_paired:
                    qr_window.show()
                return
            threading.Event().wait(0.2)

    threading.Thread(target=wait_and_show_qr, daemon=True).start()

    def on_show_qr(icon, item):
        qr_window.show()

    def on_open_browser(icon, item):
        webbrowser.open(f"http://127.0.0.1:{PORT}/")

    def on_quit(icon, item):
        server.should_exit = True
        qr_window.destroy()
        icon.stop()

    icon = pystray.Icon(
        "orbit-agent",
        icon=load_logo(),
        title="Orbit Agent — phone remote control",
        menu=pystray.Menu(
            pystray.MenuItem("Show connection QR", on_show_qr, default=True),
            pystray.MenuItem("Open Orbit in browser", on_open_browser),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit Orbit", on_quit),
        ),
    )
    icon.run()


if __name__ == "__main__":
    main_tray()
