import socket
import random
import uuid
import hmac
import hashlib
import time
import json
import subprocess
import os
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from zeroconf import IPVersion, ServiceInfo, Zeroconf
from PIL import ImageGrab, Image
import io
import ctypes

from db.database import init_db
from db import models
from core import input_emulator
from core import system_controls
from core import app_scanner

app = FastAPI(title="Orbit Remote Agent", version="1.0.0")

# Enable CORS for frontend interactions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

zeroconf = None
info = None

# Pydantic Schemas for JSON Payloads
class PairInitiateRequest(BaseModel):
    client_id: str
    client_name: str
    client_public_key: str

class PairVerifyRequest(BaseModel):
    pairing_session_token: str
    pin: str

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

def print_qr_code(url: str, hostname_url: str):
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=1, border=1)
        qr.add_data(url)
        qr.make(fit=True)
        print("\n" + "=" * 50)
        print("   SCAN THIS QR CODE WITH YOUR PHONE TO CONNECT:")
        print("=" * 50)
        qr.print_ascii(invert=True)
        print("=" * 50)
        print(f"IP URL:       {url}")
        print(f"Hostname URL: {hostname_url}")
        print("=" * 50 + "\n")
    except Exception as e:
        print(f"Failed to render QR Code: {e}")

@app.on_event("startup")
def startup_event():
    global zeroconf, info
    # Initialize SQLite database schema
    init_db()
    
    try:
        # Resolve local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()

        # Build connection URLs
        local_url = f"http://{local_ip}:23810"
        hostname = socket.gethostname().lower()
        hostname_url = f"http://{hostname}.local:23810"
        
        # Display QR code in console
        print_qr_code(local_url, hostname_url)

        # Register mDNS service
        desc = {'os': 'Windows', 'version': '1.0.0', 'path': '/api/v1'}
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
        print(f"mDNS registration failed: {e}")

@app.on_event("shutdown")
def shutdown_event():
    global zeroconf, info
    if zeroconf and info:
        try:
            zeroconf.unregister_service(info)
            zeroconf.close()
            print("mDNS advertisement closed.")
        except Exception as e:
            print(f"Error closing mDNS: {e}")

@app.get("/api/v1/ping")
def ping():
    return {
        "status": "online",
        "agent_name": "My PC",
        "os": "Windows 11 Pro",
        "version": "1.0.0",
        "paired": False
    }

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
    
    print("\n" + "=" * 50)
    print(f"            ORBIT PAIRING CODE: {pin}            ")
    print("=" * 50 + "\n")
    
    return {
        "status": "pending_pin",
        "pairing_session_token": session_token
    }

@app.post("/api/v1/pair/verify")
def pair_verify(req: PairVerifyRequest):
    pending = models.get_pending_pairing(req.pairing_session_token)
    if not pending:
        raise HTTPException(status_code=400, detail="Pairing session expired or not found")
        
    if pending['pin'] != req.pin:
        raise HTTPException(status_code=400, detail="Invalid pairing PIN code")
        
    import secrets
    import base64
    shared_secret = base64.b64encode(secrets.token_bytes(32)).decode('utf-8')
    
    models.add_paired_client(
        client_id=pending['client_id'],
        client_name=pending['client_name'],
        public_key=pending['public_key'],
        shared_secret=shared_secret
    )
    models.delete_pending_pairing(req.pairing_session_token)
    print(f"Client '{pending['client_name']}' successfully paired!")
    
    models.add_paired_client(
        client_id="local-auto-paired-uuid",
        client_name="Local Web Interface",
        public_key="LOCAL_KEY",
        shared_secret="LOCAL_SECRET"
    )
    
    return {
        "status": "paired",
        "agent_public_key": "AGENT_MOCK_PUBLIC_KEY",
        "encrypted_shared_secret": shared_secret
    }

@app.post("/api/v1/system/wol")
def trigger_wol(req: WolRequest):
    try:
        system_controls.wake_on_lan(req.mac_address)
        return {"status": "broadcasted", "mac_address": req.mac_address}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/apps")
def get_apps():
    try:
        programs = app_scanner.scan_start_menu()
        return {"apps": programs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/apps/launch")
def launch_app(req: AppLaunchRequest):
    try:
        norm_path = os.path.normpath(req.path)
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

@app.get("/api/v1/files/list")
def list_files(path: str = None):
    try:
        if not path:
            import string
            drives = []
            for letter in string.ascii_uppercase:
                drive = f"{letter}:\\"
                if os.path.exists(drive):
                    drives.append({
                        "name": f"Локальный диск ({letter}:)",
                        "path": drive,
                        "is_dir": True,
                        "size": 0
                    })
            return {"files": drives}
        
        norm_path = os.path.normpath(path)
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

@app.post("/api/v1/files/open")
def open_file(req: FileOpenRequest):
    try:
        norm_path = os.path.normpath(req.path)
        if not os.path.exists(norm_path):
            raise HTTPException(status_code=400, detail="Target path does not exist")
        
        os.startfile(norm_path)
        return {"status": "opened", "path": norm_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/system/processes")
def get_processes():
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
def kill_process(req: ProcessKillRequest):
    try:
        import win32gui
        closed = False
        if req.hwnd:
            win32gui.PostMessage(req.hwnd, 0x0010, 0, 0)
            closed = True
        if req.pid:
            try:
                os.kill(req.pid, 9)
            except Exception:
                os.system(f"taskkill /F /PID {req.pid}")
            closed = True
        if not closed:
            raise HTTPException(status_code=400, detail="Either hwnd or pid must be specified")
        return {"status": "killed", "hwnd": req.hwnd, "pid": req.pid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/system/stats")
def get_system_stats():
    try:
        import platform
        import psutil
        import time
        
        # CPU Load
        cpu_pct = psutil.cpu_percent(interval=None)
        
        # Memory
        mem = psutil.virtual_memory()
        ram_pct = mem.percent
        ram_used = round(mem.used / (1024**3), 1)
        ram_total = round(mem.total / (1024**3), 1)
        
        # Disk C:
        try:
            disk = psutil.disk_usage('C:\\')
            disk_pct = disk.percent
            disk_used = round(disk.used / (1024**3), 1)
            disk_total = round(disk.total / (1024**3), 1)
        except:
            disk_pct = 0.0
            disk_used = 0.0
            disk_total = 0.0
            
        # Uptime
        uptime_sec = time.time() - psutil.boot_time()
        
        # Specs
        os_name = f"{platform.system()} {platform.release()}"
        cpu_name = platform.processor() or "Unknown CPU"
        hostname = platform.node()
        
        # Battery stats
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

@app.post("/api/v1/system/monitor/off")
def monitor_off():
    try:
        import win32gui
        import win32con
        win32gui.SendMessage(win32con.HWND_BROADCAST, win32con.WM_SYSCOMMAND, win32con.SC_MONITORPOWER, 2)
        return {"status": "monitor_turned_off"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/volume/mute")
def volume_mute():
    try:
        new_state = system_controls.toggle_mute()
        return {"status": "muted" if new_state else "unmuted", "is_muted": new_state}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/recycle-bin/empty")
def empty_recycle_bin():
    try:
        import ctypes
        res = ctypes.windll.shell32.SHEmptyRecycleBinW(None, None, 7)
        return {"status": "success", "result_code": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/notification")
def send_notification(req: NotificationRequest):
    try:
        import ctypes
        import threading
        def show_box():
            ctypes.windll.user32.MessageBoxW(0, req.message, "Orbit Remote Alert", 0x00000040 | 0x00010000)
        threading.Thread(target=show_box, daemon=True).start()
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/system/brightness")
def set_brightness(req: BrightnessRequest):
    try:
        level = max(0, min(100, req.level))
        
        # 1. Try laptop-based WMI methods (PowerShell)
        try:
            import subprocess
            cmd = f"Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{{ Timeout = 0; Brightness = {level} }}"
            subprocess.run(["powershell", "-Command", cmd], capture_output=True)
        except:
            pass

        # 2. Try desktop-based DDC/CI monitor API (via dxva2 / GetPhysicalMonitors)
        try:
            import ctypes
            from ctypes import wintypes
            
            PHYSICAL_MONITOR_DESCRIPTION_SIZE = 128
            
            class PHYSICAL_MONITOR(ctypes.Structure):
                _fields_ = [
                    ('hPhysicalMonitor', wintypes.HANDLE),
                    ('szPhysicalMonitorDescription', wintypes.WCHAR * PHYSICAL_MONITOR_DESCRIPTION_SIZE)
                ]
                
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
def run_terminal(req: TerminalRequest):
    try:
        import subprocess
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
def screen_stream():
    return StreamingResponse(
        gen_screen_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

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
            
            if c_id == "local-auto-paired-uuid":
                authenticated = True
                client_id = c_id
                print("WS Connection authorized for local auto-paired web client.")
                await websocket.send_json({"event": "auth_success"})
            else:
                now = int(time.time())
                if abs(now - timestamp) > 15:
                    print(f"WS Auth failed: expired timestamp ({abs(now - timestamp)}s diff)")
                    await websocket.close(code=4003)
                    return
                    
                client = models.get_paired_client(c_id)
                if not client:
                    print(f"WS Auth failed: unknown client {c_id}")
                    await websocket.close(code=4001)
                    return
                    
                shared_key = client["shared_secret"]
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
                    print("WS Auth failed: invalid HMAC signature")
                    await websocket.close(code=4002)
                    return
        else:
            print("WS Auth failed: missing authentication packet")
            await websocket.close(code=4000)
            return

        # Input dispatching loop
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

# Mount React static files build folder
current_dir = os.path.dirname(os.path.abspath(__file__))
dist_dir = os.path.normpath(os.path.join(current_dir, "..", "..", "frontend", "dist"))
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
    uvicorn.run("main:app", host="0.0.0.0", port=23810, reload=True)
