import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronRight, Wand2 } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';
import { AppPicker } from '../AppPicker';
import { WidgetPreview } from './WidgetPreview';
import { WIDGET_CATALOG } from './catalog';
import type { WidgetInstance, WidgetSize, WidgetType } from './types';

interface Scenario {
  id: number;
  name: string;
}

interface AddWidgetSheetProps {
  existingTypes: WidgetType[];
  onAdd: (type: WidgetType, size: WidgetSize, config?: Record<string, unknown>) => void;
  onClose: () => void;
}

export function AddWidgetSheet({ existingTypes, onAdd, onClose }: AddWidgetSheetProps) {
  const { request } = useOrbit();
  const [pickingMacro, setPickingMacro] = useState(false);
  const [pickingApp, setPickingApp] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  const openMacroPicker = () => {
    setPickingMacro(true);
    setLoadingScenarios(true);
    request('/api/v1/scenarios')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setScenarios(data?.scenarios || []))
      .catch(() => {})
      .finally(() => setLoadingScenarios(false));
  };

  const pick = (type: WidgetType, defaultSize: WidgetSize) => {
    if (type === 'macroLauncher') return openMacroPicker();
    if (type === 'appShortcut') return setPickingApp(true);
    onAdd(type, defaultSize);
    onClose();
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[65] bg-slate-950/40 backdrop-blur-md flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-[430px] rounded-t-[32px] p-5 pb-0 flex flex-col gap-3 bg-[var(--phone-bg)] border border-black/5"
          style={{ maxHeight: 'min(78dvh, calc(100dvh - 140px))' }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center" style={{ flexShrink: 0 }}>
            <div>
              <h2 className="m-0 text-xl font-black text-var-ink">
                {pickingMacro ? 'Choose a macro' : 'Add a widget'}
              </h2>
              <span className="text-xs text-[#8c94a0] font-bold">
                {pickingMacro ? 'Pick which automation to shortcut' : 'Tap to add it to your Home screen'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#6e7682]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="sheet-scroll-body" style={{ paddingBottom: 20 }}>
            {pickingMacro ? (
              loadingScenarios ? (
                <div className="empty-state">Loading macros…</div>
              ) : scenarios.length ? (
                <div className="set-group">
                  {scenarios.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="set-row"
                      onClick={() => {
                        onAdd('macroLauncher', '1x1', { macroId: s.id });
                        onClose();
                      }}
                    >
                      <span className="r-ico">
                        <Wand2 size={16} />
                      </span>
                      <span className="r-name">{s.name}</span>
                      <ChevronRight size={18} className="text-[#9aa3b0]" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No macros yet — create one in Settings → Automations first.</div>
              )
            ) : (
              <div className="wp-grid">
                {WIDGET_CATALOG.map((meta) => {
                  const disabled = Boolean(meta.singleton && existingTypes.includes(meta.type));
                  return (
                    <button
                      key={meta.type}
                      type="button"
                      className="wp-card"
                      disabled={disabled}
                      onClick={() => pick(meta.type, meta.defaultSize)}
                    >
                      <div className="wp-preview">
                        <WidgetPreview type={meta.type} />
                      </div>
                      <div className="wp-card-foot">
                        <span className="wp-label">{meta.label}</span>
                        {disabled && <span className="wp-added">Added</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {pickingApp && (
        <AppPicker
          launchOnPick={false}
          onPick={(app) => {
            onAdd('appShortcut', '1x1', { appPath: app.path, appName: app.name });
            onClose();
          }}
          onClose={() => setPickingApp(false)}
        />
      )}
    </>
  );
}
