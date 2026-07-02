import { motion } from 'framer-motion';
import { tabs, settingsTab } from '../constants';
import { useOrbit } from '../state/OrbitContext';
import type { View } from '../types';

interface NavbarProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

/** Bottom dock: five destinations in one pill — four navigable views plus
 * Settings, which opens a sheet instead of switching the active view. */
export function Navbar({ activeView, setActiveView }: NavbarProps) {
  const { openSettings } = useOrbit();

  return (
    <div className="dock-bar">
      <nav className="nav-pill" aria-label="Primary navigation">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={activeView === id ? 'active' : ''}
            onClick={() => setActiveView(id)}
            aria-label={label}
          >
            {activeView === id && (
              <motion.div
                layoutId="activeNavPill"
                className="absolute inset-0 bg-[#007aff] rounded-full z-[1]"
                style={{ boxShadow: '0 6px 16px rgba(0, 122, 255, 0.25)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <Icon size={20} style={{ position: 'relative', zIndex: 2 }} />
            <span>{label}</span>
          </button>
        ))}

        <button type="button" onClick={openSettings} aria-label={settingsTab.label}>
          <settingsTab.icon size={20} />
          <span>{settingsTab.label}</span>
        </button>
      </nav>
    </div>
  );
}
