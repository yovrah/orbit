# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller build spec for the Orbit agent.

Produces a self-contained onedir app (dist/Orbit/Orbit.exe) with the built
frontend bundled inside, so end users need neither Python nor Node — download,
unzip, double-click. Run from the `agent` folder:

    venv\\Scripts\\pyinstaller --clean --noconfirm orbit.spec
"""
import os
from PyInstaller.utils.hooks import collect_submodules, collect_all

block_cipher = None

# The built frontend is bundled as read-only data at `frontend/dist`, matching
# what paths.resource_path('frontend/dist') expects at runtime.
datas = [(os.path.join('..', 'frontend', 'dist'), os.path.join('frontend', 'dist'))]

hiddenimports = []
# uvicorn/zeroconf/comtypes lazy-import their backends by string, so PyInstaller
# can't see them from the import graph — pull the whole subtrees in explicitly.
for pkg in ('uvicorn', 'zeroconf', 'comtypes'):
    hiddenimports += collect_submodules(pkg)
hiddenimports += ['win32timezone', 'wsproto']

# soundcard ships platform backend modules + relies on cffi; grab everything.
sc_datas, sc_binaries, sc_hidden = collect_all('soundcard')
datas += sc_datas
hiddenimports += sc_hidden

a = Analysis(
    [os.path.join('src', 'tray.py')],
    pathex=['src'],  # so `main`, `paths`, `db.*`, `core.*` resolve
    binaries=sc_binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=['rthook_coinit.py'],  # set COM mode before pywin32/comtypes init
    excludes=['tkinter.test', 'test', 'unittest'],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Orbit',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,  # windowed: no console flashes when double-clicked
    icon='orbit.ico',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='Orbit',
)
