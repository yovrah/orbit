import { useState } from 'react';
import { Plus } from 'lucide-react';
import { usePinnedApps } from '../usePinnedApps';
import { useApps } from '../../pc/useApps';
import { PinTile } from '../PinTile';
import { AppPicker } from '../AppPicker';

export function PinnedAppsWidget() {
  const { pins, addPin, removePin } = usePinnedApps();
  const { launch } = useApps();
  const [showPicker, setShowPicker] = useState(false);
  const [editingPins, setEditingPins] = useState(false);

  return (
    <>
      <div className="w-title-row">
        <span className="w-title">Pinned Apps</span>
        <button type="button" className="w-link" onClick={() => setEditingPins((v) => !v)}>
          {editingPins ? 'Done' : 'Edit'}
        </button>
      </div>
      <div className="pins w-pins">
        {pins.map((app) => (
          <PinTile
            key={app.path}
            app={app}
            editing={editingPins}
            onClick={() => (editingPins ? removePin(app.path) : launch(app.path))}
          />
        ))}
        <button type="button" className="pin" onClick={() => setShowPicker(true)}>
          <span className="pin-ico add">
            <Plus size={20} />
          </span>
          <small>Add</small>
        </button>
      </div>
      {showPicker && <AppPicker onPick={addPin} onClose={() => setShowPicker(false)} />}
    </>
  );
}
