"""Path resolution that works both from source and from a PyInstaller build.

When frozen, PyInstaller unpacks bundled data (the built frontend, the logo)
next to the executable and exposes that root via ``sys._MEIPASS``. From source
those same files live in the repo tree. Writable state (logs, the SQLite DB)
must never live inside the bundle — it goes next to the .exe when frozen, or in
the repo's ``agent`` folder from source.
"""
import os
import sys

IS_FROZEN = getattr(sys, "frozen", False)


def bundle_root() -> str:
    """Read-only root where bundled resources (frontend/dist, icons) live."""
    if IS_FROZEN:
        # PyInstaller sets _MEIPASS to the extraction dir (onefile) or the
        # _internal folder (onedir); bundled `datas` land under it.
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    # From source: repo root is two levels up from this file (agent/src/..).
    return os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


def resource_path(rel: str) -> str:
    """Absolute path to a bundled, read-only resource (e.g. 'frontend/dist')."""
    return os.path.normpath(os.path.join(bundle_root(), rel))


def app_dir() -> str:
    """Folder for writable, per-install files (logs). Next to the .exe when
    frozen so users can find their logs; the agent folder from source."""
    if IS_FROZEN:
        return os.path.dirname(sys.executable)
    return os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


def logs_dir() -> str:
    path = os.path.join(app_dir(), "logs")
    os.makedirs(path, exist_ok=True)
    return path
