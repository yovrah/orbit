from pynput.mouse import Controller as MouseController, Button
from pynput.keyboard import Controller as KeyboardController, Key

mouse = MouseController()
keyboard = KeyboardController()

# Map modifier names to pynput Key enums
MODIFIER_MAP = {
    "ctrl": Key.ctrl,
    "alt": Key.alt,
    "shift": Key.shift,
    "win": Key.cmd
}

# Map special key string labels to pynput Key enums
SPECIAL_KEYS_MAP = {
    "backspace": Key.backspace,
    "enter": Key.enter,
    "tab": Key.tab,
    "esc": Key.esc,
    "escape": Key.esc,
    "space": Key.space,
    "up": Key.up,
    "down": Key.down,
    "left": Key.left,
    "right": Key.right,
    "delete": Key.delete,
    "home": Key.home,
    "end": Key.end,
    "pageup": Key.page_up,
    "pagedown": Key.page_down,
    "f1": Key.f1,
    "f2": Key.f2,
    "f3": Key.f3,
    "f4": Key.f4,
    "f5": Key.f5,
    "f6": Key.f6,
    "f7": Key.f7,
    "f8": Key.f8,
    "f9": Key.f9,
    "f10": Key.f10,
    "f11": Key.f11,
    "f12": Key.f12,
    "media_play_pause": Key.media_play_pause,
    "media_next": Key.media_next,
    "media_previous": Key.media_previous
}

def move_mouse(dx: float, dy: float, accel: bool = True):
    scale = 1.0
    if accel:
        # Simple dynamic acceleration scaling
        speed = (dx**2 + dy**2) ** 0.5
        if speed > 15:
            scale = 2.2
        elif speed > 5:
            scale = 1.6
        else:
            scale = 1.0

    # Move cursor relatively
    mouse.move(int(dx * scale), int(dy * scale))

def click_mouse(button: str, click_type: str = "click"):
    btn = Button.left
    if button == "right":
        btn = Button.right
    elif button == "middle":
        btn = Button.middle

    if click_type == "click":
        mouse.click(btn, 1)
    elif click_type == "double":
        mouse.click(btn, 2)
    elif click_type == "down":
        mouse.press(btn)
    elif click_type == "up":
        mouse.release(btn)

def scroll_mouse(dx: float, dy: float):
    # Windows native scroll direction: negative vertical delta scrolls down
    mouse.scroll(int(dx), int(dy))

def handle_keyboard(key: str, key_type: str = "keydown", modifiers: dict = None):
    active_modifiers = []
    if modifiers:
        for mod_name, is_active in modifiers.items():
            if is_active and mod_name in MODIFIER_MAP:
                active_modifiers.append(MODIFIER_MAP[mod_name])

    # Determine key target
    target_key = None
    key_lower = key.lower()
    if key_lower in SPECIAL_KEYS_MAP:
        target_key = SPECIAL_KEYS_MAP[key_lower]
    elif len(key) == 1:
        target_key = key
    
    # Check if strong modifiers (Ctrl, Alt, Win) are active
    has_strong_modifiers = any(m in active_modifiers for m in [Key.ctrl, Key.alt, Key.cmd])

    # Emulate key stroke
    if target_key:
        try:
            if len(target_key) == 1 and not has_strong_modifiers and key_type == "press":
                if Key.shift in active_modifiers:
                    keyboard.type(target_key.upper())
                else:
                    keyboard.type(target_key)
            else:
                # Press active modifier keys
                for mod_key in active_modifiers:
                    keyboard.press(mod_key)

                if key_type == "keydown":
                    keyboard.press(target_key)
                elif key_type == "keyup":
                    keyboard.release(target_key)
                elif key_type == "press":
                    keyboard.press(target_key)
                    keyboard.release(target_key)

                # Release modifier keys in reverse order
                for mod_key in reversed(active_modifiers):
                    keyboard.release(mod_key)
        except Exception as e:
            print(f"Emulate key failed for {key}: {e}")


def move_mouse_absolute(x_ratio: float, y_ratio: float):
    import ctypes
    user32 = ctypes.windll.user32
    user32.SetProcessDPIAware()
    width = user32.GetSystemMetrics(0)
    height = user32.GetSystemMetrics(1)
    
    target_x = int(x_ratio * width)
    target_y = int(y_ratio * height)
    
    # Clip to boundaries
    target_x = max(0, min(width - 1, target_x))
    target_y = max(0, min(height - 1, target_y))
    
    mouse.position = (target_x, target_y)

def handle_key_combo(keys: list):
    pressed_modifiers = []
    try:
        for key in keys:
            key_lower = key.lower()
            if key_lower in MODIFIER_MAP:
                mod_key = MODIFIER_MAP[key_lower]
                keyboard.press(mod_key)
                pressed_modifiers.append(mod_key)
            else:
                target_key = None
                if key_lower in SPECIAL_KEYS_MAP:
                    target_key = SPECIAL_KEYS_MAP[key_lower]
                elif len(key) == 1:
                    target_key = key
                
                if target_key:
                    try:
                        keyboard.press(target_key)
                        keyboard.release(target_key)
                    except Exception as e:
                        print(f"Failed to press key {target_key} in combo: {e}")
    except Exception as e:
        print(f"Error in key combo emulation: {e}")
    finally:
        for mod_key in reversed(pressed_modifiers):
            try:
                keyboard.release(mod_key)
            except:
                pass


