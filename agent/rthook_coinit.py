"""PyInstaller runtime hook — runs before any bundled/contributed rthook.

Both pythoncom (pywin32) and comtypes (pycaw) initialize COM on import and read
`sys.coinit_flags` to decide the apartment mode. If pythoncom's rthook inits STA
first, comtypes' later CoInitializeEx(MTA) raises RPC_E_CHANGED_MODE. Setting the
flag here — before either runs — makes both pick multithreaded, matching the
source build (main.py sets the same flag at module top)."""
import sys

sys.coinit_flags = 0  # COINIT_MULTITHREADED
