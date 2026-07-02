import os
import re
import socket
from ctypes import cast, POINTER
from comtypes import CLSCTX_ALL
from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

def get_volume_interface():
    # Helper to resolve the Windows audio endpoint volume interface.
    # pycaw >= 2024 wraps the device in AudioDevice (EndpointVolume property);
    # older releases return the raw COM device that must be Activate()d.
    device = AudioUtilities.GetSpeakers()
    endpoint = getattr(device, "EndpointVolume", None)
    if endpoint is not None:
        return endpoint
    interface = device.Activate(
        IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(interface, POINTER(IAudioEndpointVolume))

def get_volume() -> int:
    try:
        volume = get_volume_interface()
        return int(volume.GetMasterVolumeLevelScalar() * 100)
    except Exception as e:
        print(f"Error reading system volume: {e}")
        return 50

def set_volume(level: int):
    try:
        volume = get_volume_interface()
        # Ensure level is clamped between 0 and 100
        clamped_level = max(0, min(100, level))
        volume.SetMasterVolumeLevelScalar(clamped_level / 100.0, None)
        print(f"System volume adjusted to: {clamped_level}%")
    except Exception as e:
        print(f"Error writing system volume: {e}")

def suspend_system():
    print("Suspending system (Sleep)...")
    # Triggers Windows SetSuspendState API (Hibernate=0, Force=1, DisableWakeup=0)
    os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")

def shutdown_system():
    print("Shutting down host computer...")
    os.system("shutdown /s /t 0")

def restart_system():
    print("Restarting host computer...")
    os.system("shutdown /r /t 0")

def wake_on_lan(mac_address: str):
    # Clean MAC string format (remove colons, dashes, and spaces)
    clean_mac = re.sub(r'[^a-fA-F0-9]', '', mac_address)
    if len(clean_mac) != 12:
        raise ValueError("Invalid MAC Address format")
        
    mac_bytes = bytes.fromhex(clean_mac)
    magic_packet = b'\xff' * 6 + mac_bytes * 16

    # Open UDP socket with broadcast permission
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    
    # Send broadcast to ports 7 and 9
    s.sendto(magic_packet, ('255.255.255.255', 9))
    s.sendto(magic_packet, ('255.255.255.255', 7))
    s.close()
    
    print(f"WoL Magic Packet broadcasted to MAC: {mac_address}")

def toggle_mute() -> bool:
    try:
        volume = get_volume_interface()
        is_muted = volume.GetMute()
        new_mute = not is_muted
        volume.SetMute(new_mute, None)
        print(f"System volume mute toggled: {new_mute}")
        return new_mute
    except Exception as e:
        print(f"Error toggling mute: {e}")
        return False

def get_mute() -> bool:
    try:
        volume = get_volume_interface()
        return bool(volume.GetMute())
    except Exception as e:
        print(f"Error reading mute state: {e}")
        return False
