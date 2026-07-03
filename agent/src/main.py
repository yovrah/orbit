import sys
sys.coinit_flags = 0

import socket
import random
import uuid
import hmac
import hashlib
import time
import json
import subprocess
import os
import secrets
import base64
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, Depends, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from zeroconf import IPVersion, ServiceInfo, Zeroconf
from PIL import ImageGrab, Image
import io
import ctypes
import win32clipboard
import mss
import numpy as np

# soundcard initializes Windows Media Foundation at import time, which can fail
# in some environments (notably a frozen/packaged build). It only powers the
# optional "stream PC audio" feature, so import it lazily and let that one
# feature degrade instead of taking the whole agent down.
_soundcard = None
_soundcard_tried = False

def get_soundcard():
    global _soundcard, _soundcard_tried
    if not _soundcard_tried:
        _soundcard_tried = True
        try:
            import soundcard as _sc
            _soundcard = _sc
        except Exception as e:
            print(f"Audio streaming unavailable (soundcard failed to load): {e!r}")
            _soundcard = None
    return _soundcard

from db.database import init_db
from db import models
from db import scenario_models
from core import input_emulator
from core import system_controls
from core import app_scanner
from core import icon_extractor

# Generated with 32 random bytes in lifespan() before the server accepts
# requests. Starts as None so auth hard-fails rather than accepting a known
# placeholder if the app is ever imported without the lifespan running.
LOCAL_SECRET = None
PAIRING_TOKEN = ""  # one per agent session; embedded in the QR for tap-free pairing
TERMINAL_ENABLED = False
STREAM_TOKENS = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    global zeroconf, info, LOCAL_SECRET, PAIRING_TOKEN
    # Render the QR/Unicode cleanly in the console (default Windows codepage
    # raises 'charmap' on the QR block characters and drops the code entirely).
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    init_db()

    LOCAL_SECRET = base64.b64encode(secrets.token_bytes(32)).decode('utf-8')
    PAIRING_TOKEN = secrets.token_urlsafe(24)

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()

        local_url = f"http://{local_ip}:23810"
        hostname = socket.gethostname().lower()
        hostname_url = f"http://{hostname}.local:23810"
        # The QR encodes a self-pairing URL: opening it auto-connects the phone.
        pair_url = f"{local_url}/?pair={PAIRING_TOKEN}"

        print_qr_code(pair_url, local_url, hostname_url)

        desc = {'os': 'Windows', 'version': '1.0.1', 'path': '/api/v1'}
        info = ServiceInfo(
            "_orbit-control._tcp.local.",
            f"{hostname}._orbit-control._tcp.local.",
            addresses=[socket.inet_aton(local_ip)],
            port=23810,
            properties=desc,
        )
        zeroconf = Zeroconf(ip_version=IPVersion.V4Only)
        zeroconf.register_service(info)
        print(f"Orbit Agent advertised via mDNS on {local_ip}:23810")
    except Exception as e:
        print(f"mDNS registration failed: {e!r}")

    yield

    if zeroconf and info:
        try:
            zeroconf.unregister_service(info)
            zeroconf.close()
            print("mDNS advertisement closed.")
        except Exception as e:
            print(f"Error closing mDNS: {e}")

app = FastAPI(title="Orbit Remote Agent", version="1.0.1", lifespan=lifespan)

# The PWA is served by this same agent, so every request the app makes is
# same-origin and needs no CORS grant. The previous wildcard LAN/`.local`
# allow-list let any web page on the network read agent responses (secrets,
# pairing token, file contents) — so we deliberately expose NO cross-origin
# access. Same-origin requests are unaffected.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PairInitiateRequest(BaseModel):
    client_id: str
    client_name: str
    client_public_key: str

class PairVerifyRequest(BaseModel):
    pairing_session_token: str
    pin: str

class PairQrRequest(BaseModel):
    client_id: str
    client_name: str
    token: str

class WolRequest(BaseModel):
    mac_address: str

class AppLaunchRequest(BaseModel):
    path: str

class FileOpenRequest(BaseModel):
    path: str

class ProcessKillRequest(BaseModel):
    hwnd: int = None
    pid: int = None

class NotificationRequest(BaseModel):
    message: str

class BrightnessRequest(BaseModel):
    level: int

class TerminalRequest(BaseModel):
    command: str

class ClipboardRequest(BaseModel):
    text: str

class ScenarioStep(BaseModel):
    type: str
    param: str

class ScenarioRequest(BaseModel):
    name: str
    description: str = ""
    steps: list[ScenarioStep]

def _qr_to_ascii(qr) -> str:
    """Render the QR matrix to text without relying on console encoding.
    Two module rows are packed per text line using half-block chars."""
    m = qr.get_matrix()
    # quiet border
    pad = 2
    size = len(m)
    grid = [[False] * (size + pad * 2) for _ in range(size + pad * 2)]
    for y in range(size):
        for x in range(size):
            grid[y + pad][x + pad] = bool(m[y][x])
    lines = []
    for y in range(0, len(grid), 2):
        line = []
        for x in range(len(grid[0])):
            top = grid[y][x]
            bot = grid[y + 1][x] if y + 1 < len(grid) else False
            # dark module -> filled. Use half blocks so aspect ratio stays square-ish.
            if top and bot:
                line.append("█")
            elif top:
                line.append("▀")
            elif bot:
                line.append("▄")
            else:
                line.append(" ")
        lines.append("".join(line))
    return "\n".join(lines)

def print_qr_code(qr_url: str, ip_url: str, hostname_url: str):
    print("\n" + "=" * 50, flush=True)
    print("   SCAN THIS QR CODE WITH YOUR PHONE TO CONNECT:", flush=True)
    print("=" * 50, flush=True)
    try:
        import qrcode
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=1, border=1)
        qr.add_data(qr_url)
        qr.make(fit=True)
        try:
            qr.print_ascii(invert=True)
        except Exception:
            print(_qr_to_ascii(qr), flush=True)
    except Exception as e:
        print(f"(QR image unavailable: {e} - open the URL below manually)", flush=True)
    print("=" * 50, flush=True)
    print(f"IP URL:       {ip_url}", flush=True)
    print(f"Hostname URL: {hostname_url}", flush=True)
    print(f"Direct link:  {qr_url}", flush=True)
    print("   Scan the QR (or open the Direct link) to connect instantly.", flush=True)
    print("=" * 50 + "\n", flush=True)

async def verify_auth_header(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Orbit-HMAC "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    parts = auth_header[len("Orbit-HMAC "):].split(":")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Malformed Authorization header")
        
    client_id, timestamp_str, signature = parts
    
    try:
        timestamp = int(timestamp_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid timestamp")
        
    now = int(time.time())
    if abs(now - timestamp) > 15:
        raise HTTPException(status_code=401, detail="Timestamp expired")
        
    if client_id == "local-auto-paired-uuid":
        shared_key = LOCAL_SECRET
    else:
        client = models.get_paired_client(client_id)
        if not client:
            raise HTTPException(status_code=401, detail="Unknown client ID")
        shared_key = client["shared_secret"]

    if not shared_key:
        raise HTTPException(status_code=401, detail="Server not ready")

    message = f"{client_id}:{timestamp}".encode('utf-8')
    expected = hmac.new(
        shared_key.encode('utf-8'),
        message,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    return client_id

AuthDep = Depends(verify_auth_header)

def verify_ws_auth(client_id: str, timestamp_str: str, signature: str, client_host: str) -> bool:
    try:
        timestamp = int(timestamp_str)
    except ValueError:
        return False
        
    now = int(time.time())
    if abs(now - timestamp) > 15:
        return False
        
    if client_id == "local-auto-paired-uuid":
        shared_key = LOCAL_SECRET
    else:
        client = models.get_paired_client(client_id)
        if not client:
            return False
        shared_key = client["shared_secret"]

    if not shared_key:
        return False

    message = f"{client_id}:{timestamp}".encode('utf-8')
    expected = hmac.new(
        shared_key.encode('utf-8'),
        message,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected, signature)

def get_mac_address() -> str:
    try:
        mac = uuid.getnode()
        return ':'.join(['{:02x}'.format((mac >> ele) & 0xff) for ele in range(0, 8*6, 8)][::-1])
    except Exception:
        return "00:00:00:00:00:00"

@app.get("/api/v1/local/secret")
def get_local_secret(request: Request):
    client_host = request.client.host
    if client_host not in ["127.0.0.1", "::1", "localhost"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"secret": LOCAL_SECRET}

@app.get("/api/v1/ping")
def ping():
    import platform
    return {
        "status": "online",
        "agent_name": platform.node() or "My PC",
        "os": f"{platform.system()} {platform.release()}",
        "version": "1.0.1",
        "paired": False,
        "mac_address": get_mac_address()
    }

# Short-lived PIN sessions: expire after PIN_TTL and lock after PIN_MAX_TRIES
# wrong guesses, so a 6-digit PIN can't be brute-forced. Kept in memory since
# pairing state is per-session anyway.
PIN_TTL = 120  # seconds
PIN_MAX_TRIES = 5
PENDING_PINS = {}  # session_token -> {"expires": epoch, "tries": int}

@app.post("/api/v1/pair/initiate")
def pair_initiate(req: PairInitiateRequest):
    pin = f"{random.randint(100000, 999999)}"
    session_token = str(uuid.uuid4())

    models.add_pending_pairing(
        session_token=session_token,
        client_id=req.client_id,
        client_name=req.client_name,
        public_key=req.client_public_key,
        pin=pin
    )
    PENDING_PINS[session_token] = {"expires": time.time() + PIN_TTL, "tries": 0}

    print("\n" + "=" * 50, flush=True)
    print(f"            ORBIT PAIRING CODE: {pin}            ", flush=True)
    print("=" * 50 + "\n", flush=True)

    return {
        "status": "pending_pin",
        "pairing_session_token": session_token
    }

@app.post("/api/v1/pair/verify")
def pair_verify(req: PairVerifyRequest):
    pending = models.get_pending_pairing(req.pairing_session_token)
    meta = PENDING_PINS.get(req.pairing_session_token)
    if not pending or not meta:
        raise HTTPException(status_code=400, detail="Pairing session expired or not found")

    if time.time() > meta["expires"]:
        PENDING_PINS.pop(req.pairing_session_token, None)
        models.delete_pending_pairing(req.pairing_session_token)
        raise HTTPException(status_code=400, detail="Pairing session expired")

    if meta["tries"] >= PIN_MAX_TRIES:
        PENDING_PINS.pop(req.pairing_session_token, None)
        models.delete_pending_pairing(req.pairing_session_token)
        raise HTTPException(status_code=429, detail="Too many attempts — restart pairing")

    if not hmac.compare_digest(str(pending['pin']), str(req.pin)):
        meta["tries"] += 1
        raise HTTPException(status_code=400, detail="Invalid pairing PIN code")

    PENDING_PINS.pop(req.pairing_session_token, None)
        
    shared_secret = base64.b64encode(secrets.token_bytes(32)).decode('utf-8')
    
    models.add_paired_client(
        client_id=pending['client_id'],
        client_name=pending['client_name'],
        public_key=pending['public_key'],
        shared_secret=shared_secret
    )
    models.delete_pending_pairing(req.pairing_session_token)
    print(f"Client '{pending['client_name']}' successfully paired!")
    
    return {
        "status": "paired",
        "agent_public_key": "AGENT_MOCK_PUBLIC_KEY",
        "encrypted_shared_secret": shared_secret,
        "mac_address": get_mac_address()
    }

def build_pair_url() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"
    return f"http://{ip}:23810/?pair={PAIRING_TOKEN}"

@app.get("/api/v1/pair/qrcode.png")
def pair_qrcode(request: Request):
    """Crisp PNG of the self-pairing URL — served to the PC's own browser only
    (loopback). The QR encodes the pairing token, so exposing it to the LAN
    would let any device pull the token; phones scan it off the PC screen."""
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="Forbidden")
    import qrcode
    img = qrcode.make(build_pair_url())
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")

@app.get("/pair", response_class=HTMLResponse)
def pair_page():
    """A simple page to show on the PC: scan the QR with the phone to connect."""
    return f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Pair Orbit</title>
<style>
  body{{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0d13;color:#eef0f4;
       display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}}
  .card{{background:#151822;padding:30px 26px;border-radius:26px;max-width:340px;
        box-shadow:0 20px 60px rgba(0,0,0,.4)}}
  h2{{margin:0 0 6px;font-size:20px}} p{{color:#9aa3b0;font-size:13px;line-height:1.5}}
  img{{width:250px;height:250px;background:#fff;padding:14px;border-radius:18px;margin:14px 0}}
  b{{color:#3a9bff}}
</style></head><body><div class="card">
  <h2>Scan to connect your phone</h2>
  <img src="/api/v1/pair/qrcode.png" alt="Orbit pairing QR">
  <p>Open the <b>phone camera</b> and point it at the code. The phone connects
     automatically — no PIN, no typing.</p>
  <p style="font-size:11px;opacity:.6">Phone and PC must be on the same Wi-Fi.</p>
</div></body></html>"""

@app.post("/api/v1/pair/qr")
def pair_qr(req: PairQrRequest):
    """Tap-free pairing: the phone presents the session token embedded in the QR
    code. If it matches, the client is paired immediately (no PIN). The token is
    only visible on the PC screen and the API is LAN-restricted via CORS."""
    if not PAIRING_TOKEN or not hmac.compare_digest(req.token, PAIRING_TOKEN):
        raise HTTPException(status_code=403, detail="Invalid or expired pairing token")

    shared_secret = base64.b64encode(secrets.token_bytes(32)).decode('utf-8')
    models.add_paired_client(
        client_id=req.client_id,
        client_name=req.client_name or "Orbit Phone",
        public_key=f"QR_{req.client_id}",
        shared_secret=shared_secret,
    )
    print(f"Client '{req.client_name}' paired via QR code!", flush=True)

    return {
        "status": "paired",
        "encrypted_shared_secret": shared_secret,
        "mac_address": get_mac_address(),
    }

@app.get("/api/v1/pair/token")
def pair_token(request: Request):
    """Hand the session pairing token to LOOPBACK clients only (the PWA opened on
    the PC itself). Phones must obtain the token by scanning the QR — it is
    embedded in the QR's URL — so an untrusted device on the LAN can no longer
    pull the token and pair without physical access to the screen."""
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"token": PAIRING_TOKEN}

@app.post("/api/v1/system/wol")
def trigger_wol(req: WolRequest, client_id: str = AuthDep):
    try:
        system_controls.wake_on_lan(req.mac_address)
        return {"status": "broadcasted", "mac_address": req.mac_address}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/apps")
def get_apps(client_id: str = AuthDep):
    try:
        programs = app_scanner.scan_start_menu()
        return {"apps": programs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/apps/launch")
def launch_app(req: AppLaunchRequest, client_id: str = AuthDep):
    try:
        norm_path = os.path.abspath(os.path.normpath(req.path))
        if not os.path.exists(norm_path):
            raise HTTPException(status_code=400, detail="Target executable path does not exist")
            
        subprocess.Popen(
            [norm_path],
            shell=False,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
        )
        return {"status": "launched", "path": norm_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/apps/icon")
def get_app_icon(path: str, client_id: str = AuthDep):
    try:
        norm_path = os.path.abspath(os.path.normpath(path))
        if not os.path.exists(norm_path):
            raise HTTPException(status_code=404, detail="Executable not found")
        png_bytes = icon_extractor.extract_icon_png(norm_path)
        return Response(content=png_bytes, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/files/list")
def list_files(path: str = None, client_id: str = AuthDep):
    try:
        if not path:
            import string
            import shutil
            drives = []
            for letter in string.ascii_uppercase:
                drive = f"{letter}:\\"
                if os.path.exists(drive):
                    total = 0
                    free = 0
                    try:
                        usage = shutil.disk_usage(drive)
                        total = usage.total
                        free = usage.free
                    except Exception:
                        pass
                    drives.append({
                        "name": f"Local Disk ({letter}:)",
                        "path": drive,
                        "is_dir": True,
                        "size": 0,
                        "total": total,
                        "free": free,
                    })
            return {"files": drives}
        
        norm_path = os.path.abspath(os.path.normpath(path))
        if not os.path.exists(norm_path) or not os.path.isdir(norm_path):
            raise HTTPException(status_code=400, detail="Invalid directory path")
        
        items = []
        with os.scandir(norm_path) as entries:
            for entry in entries:
                try:
                    is_dir = entry.is_dir()
                    size = 0
                    if not is_dir:
                        size = entry.stat().st_size
                    items.append({
                        "name": entry.name,
                        "path": entry.path,
                        "is_dir": is_dir,
                        "size": size
                    })
                except Exception:
                    pass
        
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        return {"files": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/files/quick")
def quick_folders(client_id: str = AuthDep):
    """Resolve the current user's well-known folders for the Files quick-access grid."""
    home = os.path.expanduser("~")
    names = ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"]
    folders = {}
    for name in names:
        candidate = os.path.join(home, name)
        if os.path.isdir(candidate):
            folders[name] = candidate
    return {"home": home, "folders": folders}

@app.post("/api/v1/files/open")
def open_file(req: FileOpenRequest, client_id: str = AuthDep):
    try:
        norm_path = os.path.abspath(os.path.normpath(req.path))
        if not os.path.exists(norm_path):
            raise HTTPException(status_code=400, detail="Target path does not exist")
        
        os.startfile(norm_path)
        return {"status": "opened", "path": norm_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/files/download")
def download_file(path: str, client_id: str = AuthDep):
    norm_path = os.path.abspath(os.path.normpath(path))
    if not os.path.exists(norm_path) or not os.path.isfile(norm_path):
        raise HTTPException(status_code=400, detail="Invalid file path")
    return FileResponse(norm_path, filename=os.path.basename(norm_path))

@app.post("/api/v1/files/upload")
async def upload_file(path: str, file: UploadFile = File(...), client_id: str = AuthDep):
    norm_dir = os.path.abspath(os.path.normpath(path))
    if not os.path.exists(norm_dir) or not os.path.isdir(norm_dir):
        raise HTTPException(status_code=400, detail="Invalid destination directory")
    # Only ever use the bare filename (strip any directory/drive components a
    # malicious client puts in file.filename), then confirm the result is truly
    # inside norm_dir via commonpath — a prefix check alone is bypassable
    # (C:\Docs vs C:\Docs2) and would allow writing outside the target folder.
    safe_name = os.path.basename(file.filename or "")
    if not safe_name or safe_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid filename")
    dest_path = os.path.abspath(os.path.join(norm_dir, safe_name))
    try:
        if os.path.commonpath([norm_dir, dest_path]) != norm_dir:
            raise HTTPException(status_code=400, detail="Path traversal detected")
    except ValueError:
        raise HTTPException(status_code=400, detail="Path traversal detected")
    try:
        contents = await file.read()
        with open(dest_path, "wb") as f:
            f.write(contents)
        return {"status": "uploaded", "filename": file.filename, "path": dest_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/system/processes")
def get_processes(client_id: str = AuthDep):
    try:
        import win32gui
        import win32process
        
        windows = []
        def enum_handler(hwnd, extra):
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd)
                if title and title not in ["Program Manager", "Start"]:
                    try:
                        _, pid = win32process.GetWindowThreadProcessId(hwnd)
                        windows.append({
                            "hwnd": hwnd,
                            "title": title,
                            "pid": pid
                        })
                    except Exception:
                        pass
        
        win32gui.EnumWindows(enum_handler, None)
        windows.sort(key=lambda x: x["title"].lower())
        return {"processes": windows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/processes/kill")
def kill_process(req: ProcessKillRequest, client_id: str = AuthDep):
    try:
        import win32gui
        closed = False
        if req.hwnd:
            win32gui.PostMessage(req.hwnd, 0x0010, 0, 0)
            closed = True
        if req.pid:
            pid = int(req.pid)  # Pydantic already types this; be explicit anyway
            try:
                os.kill(pid, 9)
            except Exception:
                # Never interpolate into a shell string — pass the PID as an arg.
                subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True)
            closed = True
        if not closed:
            raise HTTPException(status_code=400, detail="Either hwnd or pid must be specified")
        return {"status": "killed", "hwnd": req.hwnd, "pid": req.pid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/system/stats")
def get_system_stats(client_id: str = AuthDep):
    try:
        import platform
        import psutil
        import time
        
        cpu_pct = psutil.cpu_percent(interval=None)
        
        mem = psutil.virtual_memory()
        ram_pct = mem.percent
        ram_used = round(mem.used / (1024**3), 1)
        ram_total = round(mem.total / (1024**3), 1)
        
        try:
            disk = psutil.disk_usage('C:\\')
            disk_pct = disk.percent
            disk_used = round(disk.used / (1024**3), 1)
            disk_total = round(disk.total / (1024**3), 1)
        except:
            disk_pct = 0.0
            disk_used = 0.0
            disk_total = 0.0
            
        uptime_sec = time.time() - psutil.boot_time()
        
        os_name = f"{platform.system()} {platform.release()}"
        cpu_name = platform.processor() or "Unknown CPU"
        hostname = platform.node()
        
        battery_pct = None
        battery_plugged = None
        try:
            bat = psutil.sensors_battery()
            if bat:
                battery_pct = bat.percent
                battery_plugged = bat.power_plugged
        except:
            pass
        
        return {
            "cpu_percent": cpu_pct,
            "ram_percent": ram_pct,
            "ram_used_gb": ram_used,
            "ram_total_gb": ram_total,
            "disk_percent": disk_pct,
            "disk_used_gb": disk_used,
            "disk_total_gb": disk_total,
            "uptime_seconds": uptime_sec,
            "os_name": os_name,
            "cpu_name": cpu_name,
            "hostname": hostname,
            "battery_percent": battery_pct,
            "battery_plugged": battery_plugged
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/sleep")
def system_sleep(client_id: str = AuthDep):
    try:
        system_controls.suspend_system()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/shutdown")
def system_shutdown(client_id: str = AuthDep):
    try:
        system_controls.shutdown_system()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/restart")
def system_restart(client_id: str = AuthDep):
    try:
        system_controls.restart_system()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/monitor/off")
def monitor_off(client_id: str = AuthDep):
    try:
        import win32gui
        import win32con
        win32gui.SendMessage(win32con.HWND_BROADCAST, win32con.WM_SYSCOMMAND, win32con.SC_MONITORPOWER, 2)
        return {"status": "monitor_turned_off"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/system/volume")
def get_volume(client_id: str = AuthDep):
    try:
        return {"level": system_controls.get_volume(), "muted": system_controls.get_mute()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/volume/mute")
def volume_mute(client_id: str = AuthDep):
    try:
        new_state = system_controls.toggle_mute()
        return {"status": "muted" if new_state else "unmuted", "is_muted": new_state}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/recycle-bin/empty")
def empty_recycle_bin(client_id: str = AuthDep):
    try:
        res = ctypes.windll.shell32.SHEmptyRecycleBinW(None, None, 7)
        return {"status": "success", "result_code": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/logoff")
def system_logoff(client_id: str = AuthDep):
    try:
        # EWX_LOGOFF (0) | EWX_FORCE (4). Logging off needs no special privilege.
        ctypes.windll.user32.ExitWindowsEx(0x00000004, 0)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/screenshot")
def system_screenshot(client_id: str = AuthDep):
    try:
        # Emulate Win+PrtScn — Windows saves a PNG to Pictures\Screenshots
        # and copies it to the clipboard, exactly like the native shortcut.
        VK_LWIN = 0x5B
        VK_SNAPSHOT = 0x2C
        KEYEVENTF_KEYUP = 0x0002
        user32 = ctypes.windll.user32
        user32.keybd_event(VK_LWIN, 0, 0, 0)
        user32.keybd_event(VK_SNAPSHOT, 0, 0, 0)
        user32.keybd_event(VK_SNAPSHOT, 0, KEYEVENTF_KEYUP, 0)
        user32.keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/notification")
def send_notification(req: NotificationRequest, client_id: str = AuthDep):
    try:
        import threading
        def show_box():
            ctypes.windll.user32.MessageBoxW(0, req.message, "Orbit Remote Alert", 0x00000040 | 0x00010000)
        threading.Thread(target=show_box, daemon=True).start()
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/system/clipboard")
def get_clipboard(client_id: str = AuthDep):
    try:
        win32clipboard.OpenClipboard()
        try:
            if win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_UNICODETEXT):
                text = win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
            elif win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_TEXT):
                text = win32clipboard.GetClipboardData(win32clipboard.CF_TEXT).decode('utf-8', errors='ignore')
            else:
                text = ""
            return {"text": text or ""}
        finally:
            win32clipboard.CloseClipboard()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/clipboard")
def set_clipboard(req: ClipboardRequest, client_id: str = AuthDep):
    try:
        win32clipboard.OpenClipboard()
        try:
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardText(req.text, win32clipboard.CF_UNICODETEXT)
            return {"status": "success"}
        finally:
            win32clipboard.CloseClipboard()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/brightness")
def set_brightness(req: BrightnessRequest, client_id: str = AuthDep):
    try:
        level = max(0, min(100, req.level))
        try:
            cmd = f"Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{{ Timeout = 0; Brightness = {level} }}"
            subprocess.run(["powershell", "-Command", cmd], capture_output=True)
        except:
            pass
        try:
            from ctypes import wintypes
            PHYSICAL_MONITOR_DESCRIPTION_SIZE = 128
            class PHYSICAL_MONITOR(ctypes.Structure):
                _fields_ = [('hPhysicalMonitor', wintypes.HANDLE), ('szPhysicalMonitorDescription', wintypes.WCHAR * PHYSICAL_MONITOR_DESCRIPTION_SIZE)]
            def get_monitors():
                monitors = []
                def callback(hMonitor, hdcMonitor, lprcMonitor, dwData):
                    monitors.append(hMonitor)
                    return True
                MonitorEnumProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HMONITOR, wintypes.HDC, ctypes.POINTER(wintypes.RECT), wintypes.LPARAM)
                ctypes.windll.user32.EnumDisplayMonitors(None, None, MonitorEnumProc(callback), 0)
                return monitors
            for hMonitor in get_monitors():
                num_monitors = wintypes.DWORD()
                if ctypes.windll.dxva2.GetNumberOfPhysicalMonitorsFromHMONITOR(hMonitor, ctypes.byref(num_monitors)):
                    physical_monitors = (PHYSICAL_MONITOR * num_monitors.value)()
                    if ctypes.windll.dxva2.GetPhysicalMonitorsFromHMONITOR(hMonitor, num_monitors, physical_monitors):
                        for pm in physical_monitors:
                            ctypes.windll.dxva2.SetMonitorBrightness(pm.hPhysicalMonitor, level)
                        ctypes.windll.dxva2.DestroyPhysicalMonitors(num_monitors, physical_monitors)
        except:
            pass
        return {"status": "success", "level": level}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/terminal")
def run_terminal(req: TerminalRequest, client_id: str = AuthDep):
    if not TERMINAL_ENABLED:
        raise HTTPException(status_code=403, detail="Terminal functionality is disabled by security policy.")
    try:
        res = subprocess.run(
            req.command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10
        )
        return {
            "stdout": res.stdout,
            "stderr": res.stderr,
            "return_code": res.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": "Command execution timed out (10s limit)",
            "return_code": -1
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

MONITORS_CACHE: list = []

@app.get("/api/v1/screen/monitors")
async def get_monitors(client_id: str = AuthDep):
    # async on purpose: all mss/GDI work stays on the event-loop thread (same
    # thread as the stream senders) instead of short-lived threadpool workers.
    global MONITORS_CACHE
    try:
        with mss.mss() as sct:
            monitors_list = []
            for i, monitor in enumerate(sct.monitors):
                if i == 0:
                    continue
                monitors_list.append({
                    "index": i,
                    "width": monitor["width"],
                    "height": monitor["height"],
                    "left": monitor["left"],
                    "top": monitor["top"],
                    "name": f"Monitor {i}"
                })
            MONITORS_CACHE = monitors_list
            return {"monitors": monitors_list}
    except Exception as e:
        import traceback
        traceback.print_exc()
        if MONITORS_CACHE:
            # Monitor layout rarely changes — a stale answer beats a 500.
            return {"monitors": MONITORS_CACHE}
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/screen/token")
def get_stream_token(client_id: str = AuthDep):
    token = secrets.token_urlsafe(16)
    STREAM_TOKENS[token] = time.time()
    return {"token": token}

def gen_screen_frames():
    while True:
        try:
            img = ImageGrab.grab()
            max_width = 1024
            if img.width > max_width:
                height = int((max_width / img.width) * img.height)
                img = img.resize((max_width, height), Image.Resampling.BILINEAR)
            
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=50)
            frame = buf.getvalue()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        except Exception as e:
            try:
                placeholder = Image.new('RGB', (640, 360), color=(10, 10, 12))
                buf = io.BytesIO()
                placeholder.save(buf, format="JPEG", quality=30)
                frame = buf.getvalue()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            except:
                pass
        time.sleep(0.066)

@app.get("/api/v1/screen/stream")
def screen_stream(token: str = None):
    if not token or token not in STREAM_TOKENS:
        raise HTTPException(status_code=401, detail="Invalid or missing stream token")
    if time.time() - STREAM_TOKENS[token] > 60:
        del STREAM_TOKENS[token]
        raise HTTPException(status_code=401, detail="Stream token expired")
    
    return StreamingResponse(
        gen_screen_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

async def run_scenario_async(steps_list: list):
    for step in steps_list:
        step_type = step.get('type')
        param = step.get('param')
        
        if step_type == 'launch_app':
            try:
                norm_path = os.path.abspath(os.path.normpath(param))
                if os.path.exists(norm_path):
                    subprocess.Popen(
                        [norm_path],
                        shell=False,
                        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
                    )
            except Exception as e:
                print(f"Macro error launching app {param}: {e}")
                
        elif step_type == 'key_combo':
            try:
                keys = [k.strip() for k in param.split('+') if k.strip()]
                input_emulator.handle_key_combo(keys)
            except Exception as e:
                print(f"Macro error in key combo {param}: {e}")
                
        elif step_type == 'text_input':
            try:
                input_emulator.keyboard.type(param)
            except Exception as e:
                print(f"Macro error in text input: {e}")
                
        elif step_type == 'delay':
            try:
                delay_ms = int(param)
                import asyncio
                await asyncio.sleep(delay_ms / 1000.0)
            except Exception as e:
                print(f"Macro error in delay: {e}")
                
        elif step_type == 'system_action':
            try:
                if param == 'sleep':
                    system_controls.suspend_system()
                elif param == 'shutdown':
                    system_controls.shutdown_system()
                elif param == 'restart':
                    system_controls.restart_system()
                elif param == 'mute':
                    system_controls.toggle_mute()
                elif param == 'monitor_off':
                    import win32gui
                    import win32con
                    win32gui.SendMessage(win32con.HWND_BROADCAST, win32con.WM_SYSCOMMAND, win32con.SC_MONITORPOWER, 2)
                elif param == 'empty_bin':
                    ctypes.windll.shell32.SHEmptyRecycleBinW(None, None, 7)
            except Exception as e:
                print(f"Macro error in system action {param}: {e}")

@app.get("/api/v1/scenarios")
def get_scenarios(client_id: str = AuthDep):
    try:
        scenarios = scenario_models.get_scenarios()
        for sc in scenarios:
            try:
                sc['steps'] = json.loads(sc['steps'])
            except:
                sc['steps'] = []
        return {"scenarios": scenarios}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/scenarios")
def create_scenario(req: ScenarioRequest, client_id: str = AuthDep):
    try:
        steps_json = json.dumps([step.dict() for step in req.steps])
        scenario_id = scenario_models.add_scenario(req.name, req.description, steps_json)
        return {"status": "success", "id": scenario_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/v1/scenarios/{id}")
def update_scenario(id: int, req: ScenarioRequest, client_id: str = AuthDep):
    try:
        existing = scenario_models.get_scenario(id)
        if not existing:
            raise HTTPException(status_code=404, detail="Scenario not found")
        steps_json = json.dumps([step.dict() for step in req.steps])
        scenario_models.update_scenario(id, req.name, req.description, steps_json)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/scenarios/{id}")
def delete_scenario(id: int, client_id: str = AuthDep):
    try:
        existing = scenario_models.get_scenario(id)
        if not existing:
            raise HTTPException(status_code=404, detail="Scenario not found")
        scenario_models.delete_scenario(id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/scenarios/{id}/run")
async def run_scenario(id: int, client_id: str = AuthDep):
    try:
        existing = scenario_models.get_scenario(id)
        if not existing:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        try:
            steps = json.loads(existing['steps'])
        except:
            raise HTTPException(status_code=500, detail="Invalid steps layout stored")
            
        import asyncio
        asyncio.create_task(run_scenario_async(steps))
        return {"status": "started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/screen/stream")
async def websocket_screen_stream(
    websocket: WebSocket,
    client_id: str = None,
    timestamp: str = None,
    signature: str = None
):
    await websocket.accept()
    client_host = websocket.client.host
    if not client_id or not timestamp or not signature or not verify_ws_auth(client_id, timestamp, signature, client_host):
        await websocket.close(code=4003)
        return
        
    quality = 50
    fps = 30
    monitor_idx = 1
    
    import asyncio
    stop_event = asyncio.Event()
    
    async def receiver():
        nonlocal quality, fps, monitor_idx
        try:
            while not stop_event.is_set():
                data = await websocket.receive_text()
                packet = json.loads(data)
                if packet.get("event") == "config":
                    quality = max(5, min(100, packet.get("quality", quality)))
                    fps = max(1, min(60, packet.get("fps", fps)))
                    monitor_idx = packet.get("monitor", monitor_idx)
        except Exception:
            stop_event.set()
            
    async def sender():
        nonlocal quality, fps, monitor_idx
        sct = None
        grab_failures = 0
        try:
            while not stop_event.is_set():
                loop_start = time.time()
                # Capture with self-healing: a stale/exhausted GDI context is
                # rebuilt instead of silently killing the stream.
                try:
                    if sct is None:
                        sct = mss.mss()
                    idx = monitor_idx
                    if idx < 0 or idx >= len(sct.monitors):
                        idx = 1
                    sct_img = sct.grab(sct.monitors[idx])
                    grab_failures = 0
                except Exception as grab_err:
                    grab_failures += 1
                    print(f"Screen grab failed ({grab_failures}): {grab_err!r}")
                    try:
                        if sct is not None:
                            sct.close()
                    except Exception:
                        pass
                    sct = None
                    if grab_failures >= 25:
                        break
                    await asyncio.sleep(0.2)
                    continue
                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                max_width = 1024
                if img.width > max_width:
                    height = int((max_width / img.width) * img.height)
                    img = img.resize((max_width, height), Image.Resampling.BILINEAR)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=quality)
                frame_bytes = buf.getvalue()
                await websocket.send_bytes(frame_bytes)
                elapsed = time.time() - loop_start
                delay = (1.0 / fps) - elapsed
                if delay > 0:
                    await asyncio.sleep(delay)
                else:
                    await asyncio.sleep(0.001)
        except Exception:
            pass
        finally:
            stop_event.set()
            try:
                if sct is not None:
                    sct.close()
            except Exception:
                pass
            
    await asyncio.gather(receiver(), sender(), return_exceptions=True)

@app.websocket("/ws/system/audio")
async def websocket_audio_stream(
    websocket: WebSocket,
    client_id: str = None,
    timestamp: str = None,
    signature: str = None
):
    await websocket.accept()
    client_host = websocket.client.host
    if not client_id or not timestamp or not signature or not verify_ws_auth(client_id, timestamp, signature, client_host):
        await websocket.close(code=4003)
        return
        
    import asyncio
    stop_event = asyncio.Event()
    
    async def receiver():
        try:
            while not stop_event.is_set():
                await websocket.receive_text()
        except Exception:
            stop_event.set()
            
    async def sender():
        try:
            sc = get_soundcard()
            if sc is None:
                await websocket.close(code=1011)
                stop_event.set()
                return
            speaker_name = sc.default_speaker().name
            loopback_mic = sc.get_microphone(speaker_name, include_loopback=True)
            loop = asyncio.get_running_loop()
            with loopback_mic.recorder(samplerate=44100, channels=2) as recorder:
                while not stop_event.is_set():
                    data = await loop.run_in_executor(None, recorder.record, 4410)
                    pcm_data = (data * 32767).astype(np.int16).tobytes()
                    await websocket.send_bytes(pcm_data)
        except Exception:
            stop_event.set()
            
    await asyncio.gather(receiver(), sender(), return_exceptions=True)

@app.websocket("/ws/control")
async def websocket_control(websocket: WebSocket):
    await websocket.accept()
    authenticated = False
    client_id = None
    
    try:
        data = await websocket.receive_text()
        packet = json.loads(data)
        
        if packet.get("event") == "auth_handshake":
            c_id = packet.get("client_id")
            timestamp = packet.get("timestamp")
            signature = packet.get("signature")
            
            now = int(time.time())
            if abs(now - timestamp) > 15:
                print(f"WS Auth failed: expired timestamp ({abs(now - timestamp)}s diff)")
                await websocket.close(code=4003)
                return
                
            if c_id == "local-auto-paired-uuid":
                shared_key = LOCAL_SECRET
            else:
                client = models.get_paired_client(c_id)
                if not client:
                    print(f"WS Auth failed: unknown client '{c_id}'")
                    all_clients = models.get_all_paired_clients() if hasattr(models, 'get_all_paired_clients') else []
                    print(f"  Known client IDs: {[c['client_id'] for c in all_clients] if all_clients else '(none or func unavailable)'}")
                    await websocket.close(code=4001)
                    return
                shared_key = client["shared_secret"]

            if not shared_key:
                await websocket.close(code=4003)
                return

            message = f"{c_id}:{timestamp}".encode('utf-8')
            expected = hmac.new(
                shared_key.encode('utf-8'),
                message,
                hashlib.sha256
            ).hexdigest()
            
            if hmac.compare_digest(expected, signature):
                authenticated = True
                client_id = c_id
                print(f"WS Connection authorized for client ID: {client_id}")
                await websocket.send_json({"event": "auth_success"})
            else:
                print(f"WS Auth failed: invalid HMAC signature for client '{c_id}'")
                await websocket.close(code=4002)
                return
        else:
            print("WS Auth failed: missing authentication packet")
            await websocket.close(code=4000)
            return

        while authenticated:
            data = await websocket.receive_text()
            packet = json.loads(data)
            event = packet.get("event")
            
            if event == "mouse_move":
                dx = packet.get("dx", 0)
                dy = packet.get("dy", 0)
                accel = packet.get("accel", True)
                input_emulator.move_mouse(dx, dy, accel)
                
            elif event == "mouse_absolute":
                x = packet.get("x", 0.5)
                y = packet.get("y", 0.5)
                input_emulator.move_mouse_absolute(x, y)
                
            elif event == "mouse_click":
                button = packet.get("button", "left")
                click_type = packet.get("type", "click")
                input_emulator.click_mouse(button, click_type)
                
            elif event == "mouse_scroll":
                dx = packet.get("dx", 0)
                dy = packet.get("dy", 0)
                input_emulator.scroll_mouse(dx, dy)
                
            elif event == "keyboard_input":
                key = packet.get("key", "")
                key_type = packet.get("type", "keydown")
                modifiers = packet.get("modifiers", {})
                input_emulator.handle_keyboard(key, key_type, modifiers)
                
            elif event == "key_combo":
                keys = packet.get("keys", [])
                input_emulator.handle_key_combo(keys)

            elif event == "volume_set":
                level = packet.get("level", 50)
                system_controls.set_volume(level)
                
            elif event == "system_cmd":
                cmd = packet.get("cmd")
                if cmd == "sleep":
                    system_controls.suspend_system()
                elif cmd == "shutdown":
                    system_controls.shutdown_system()
                elif cmd == "restart":
                    system_controls.restart_system()
                
    except WebSocketDisconnect:
        print(f"WS connection closed for client: {client_id}")
    except Exception as e:
        print(f"WS error: {e}")
        try:
            await websocket.close()
        except:
            pass

from paths import resource_path

dist_dir = resource_path(os.path.join("frontend", "dist"))
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
    print(f"Frontend successfully mounted. Serving assets from: {dist_dir}")
else:
    print(f"Warning: static frontend dist directory not found at {dist_dir}. Serving API only.")

if __name__ == "__main__":
    import uvicorn
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    uvicorn.run("main:app", host="0.0.0.0", port=23810, reload=False)
