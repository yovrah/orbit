import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  Save,
  X,
  Clock,
  Keyboard,
  AppWindow,
  FileText,
  Sliders,
  Settings,
} from 'lucide-react';
import { useOrbit } from '../../state/OrbitContext';

interface ScenarioStep {
  type: 'launch_app' | 'key_combo' | 'text_input' | 'delay' | 'system_action';
  param: string;
}

interface Scenario {
  id?: number;
  name: string;
  description: string;
  steps: ScenarioStep[];
}

const spring = { type: 'spring', stiffness: 360, damping: 32, mass: 0.85 } as const;

const STEP_TYPES = [
  { id: 'launch_app', label: 'Launch App', icon: AppWindow, placeholder: 'C:\\Windows\\notepad.exe' },
  { id: 'key_combo', label: 'Key Combo', icon: Keyboard, placeholder: 'Ctrl+Shift+Esc' },
  { id: 'text_input', label: 'Type Text', icon: FileText, placeholder: 'Hello from Orbit!' },
  { id: 'delay', label: 'Wait Delay (ms)', icon: Clock, placeholder: '1000' },
  { id: 'system_action', label: 'System Action', icon: Settings, placeholder: 'mute' },
];

const SYSTEM_ACTIONS = [
  { id: 'mute', label: 'Mute/Unmute Volume' },
  { id: 'monitor_off', label: 'Turn Off Monitor' },
  { id: 'empty_bin', label: 'Empty Recycle Bin' },
  { id: 'sleep', label: 'Sleep PC' },
  { id: 'restart', label: 'Restart PC' },
  { id: 'shutdown', label: 'Shutdown PC' },
];

export function MacrosTab() {
  const { activeDevice, isAuthorized, request } = useOrbit();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [macroName, setMacroName] = useState('');
  const [macroDesc, setMacroDesc] = useState('');
  const [macroSteps, setMacroSteps] = useState<ScenarioStep[]>([]);
  const [newStepType, setNewStepType] = useState<string>('launch_app');
  const [newStepParam, setNewStepParam] = useState('');

  const loadScenarios = async () => {
    if (!activeDevice || !isAuthorized) return;
    setIsLoading(true);
    try {
      const res = await request('/api/v1/scenarios');
      if (res.ok) setScenarios((await res.json()).scenarios || []);
    } catch (err) {
      console.error('Failed to load scenarios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScenarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevice?.uuid, isAuthorized]);

  const handleRunMacro = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeDevice) return;
    try {
      const res = await request(`/api/v1/scenarios/${id}/run`, { method: 'POST' });
      alert(res.ok ? 'Macro started successfully!' : 'Failed to trigger macro execution.');
    } catch {
      alert('Network error running macro.');
    }
  };

  const handleDeleteMacro = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeDevice || !confirm('Are you sure you want to delete this macro?')) return;
    try {
      const res = await request(`/api/v1/scenarios/${id}`, { method: 'DELETE' });
      if (res.ok) loadScenarios();
    } catch {
      alert('Failed to delete macro.');
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setMacroName('');
    setMacroDesc('');
    setMacroSteps([]);
    setNewStepType('launch_app');
    setNewStepParam('');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (macro: Scenario, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(macro.id || null);
    setMacroName(macro.name);
    setMacroDesc(macro.description);
    setMacroSteps([...macro.steps]);
    setNewStepType('launch_app');
    setNewStepParam('');
    setIsEditorOpen(true);
  };

  const handleAddStep = () => {
    if (!newStepParam.trim() && newStepType !== 'system_action') {
      alert('Please fill in step parameter.');
      return;
    }
    const paramVal = newStepType === 'system_action' && !newStepParam ? 'mute' : newStepParam;
    setMacroSteps([...macroSteps, { type: newStepType as ScenarioStep['type'], param: paramVal.trim() }]);
    setNewStepParam('');
  };

  const handleRemoveStep = (idx: number) => setMacroSteps(macroSteps.filter((_, i) => i !== idx));

  const handleMoveStep = (idx: number, dir: 'up' | 'down') => {
    const nextIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= macroSteps.length) return;
    const copy = [...macroSteps];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    setMacroSteps(copy);
  };

  const handleSaveMacro = async () => {
    if (!macroName.trim()) return alert('Please provide a macro name.');
    if (macroSteps.length === 0) return alert('Please add at least one step.');

    const payload = { name: macroName.trim(), description: macroDesc.trim(), steps: macroSteps };
    try {
      const endpoint = editingId ? `/api/v1/scenarios/${editingId}` : '/api/v1/scenarios';
      const res = await request(endpoint, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsEditorOpen(false);
        loadScenarios();
      } else {
        alert('Failed to save macro.');
      }
    } catch {
      alert('Network error saving macro.');
    }
  };

  const getStepIcon = (type: string) => STEP_TYPES.find((t) => t.id === type)?.icon || Sliders;

  return (
    <motion.div
      key="macros"
      className="screen-stack"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={spring}
    >
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="m-0 text-xl font-black text-var-ink">Automations</h2>
          <span className="text-[10px] text-gray-500 font-bold block">Run a sequence of commands on the PC</span>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 bg-[#007aff] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 active:scale-95 transition-all"
        >
          <Plus size={14} />
          <span>New Macro</span>
        </button>
      </div>

      {isLoading ? (
        <div className="empty-state">Loading macros...</div>
      ) : scenarios.length === 0 ? (
        <div className="empty-state">
          <span>No automation macros yet. Tap "New Macro" to build one!</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {scenarios.map((macro) => (
            <div
              key={macro.id}
              className="glass-card p-3.5 rounded-2xl border border-black/5 flex justify-between items-center bg-white/40 dark:bg-black/10"
            >
              <div className="min-w-0 flex-1 pr-3">
                <strong className="block text-sm font-black text-var-ink truncate">{macro.name}</strong>
                <span className="block text-xs text-gray-500 truncate mt-0.5">
                  {macro.description || 'No description provided.'}
                </span>
                <small className="block text-[9px] text-[#007aff] font-bold mt-1 uppercase tracking-wide">
                  {macro.steps.length} {macro.steps.length === 1 ? 'Step' : 'Steps'}
                </small>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleOpenEdit(macro, e)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-black/5 hover:bg-black/10 text-var-ink transition-all active:scale-95"
                  aria-label="Edit macro"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteMacro(macro.id!, e)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-500 border border-red-500/10 transition-all active:scale-95"
                  aria-label="Delete macro"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRunMacro(macro.id!, e)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#007aff] text-white shadow-lg shadow-blue-500/10 transition-all active:scale-95"
                  aria-label="Run macro"
                >
                  <Play size={16} fill="currentColor" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xl p-4 grid place-items-center">
          <div className="glass-card w-full max-w-[400px] h-[92dvh] rounded-[32px] p-5 flex flex-col justify-between bg-white dark:bg-slate-900 border border-black/5">
            <div className="flex justify-between items-center border-b border-black/5 pb-3" style={{ flexShrink: 0 }}>
              <div>
                <h3 className="m-0 text-[18px] font-black text-var-ink">{editingId ? 'Edit Macro' : 'Create Macro'}</h3>
                <span className="text-[10px] text-gray-500 font-bold block">Configure the step sequence</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-[#6e7682]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-var-ink">Macro Name</span>
                <input
                  value={macroName}
                  onChange={(e) => setMacroName(e.target.value)}
                  placeholder="e.g., Launch Workspace"
                  className="rounded-xl border border-black/5 bg-black/5 dark:bg-black/20 px-3.5 py-2.5 text-xs font-bold text-var-ink outline-none focus:border-[#007aff]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-var-ink">Description</span>
                <input
                  value={macroDesc}
                  onChange={(e) => setMacroDesc(e.target.value)}
                  placeholder="Opens browser, editor and mutes audio"
                  className="rounded-xl border border-black/5 bg-black/5 dark:bg-black/20 px-3.5 py-2.5 text-xs font-bold text-var-ink outline-none focus:border-[#007aff]"
                />
              </div>

              <div className="bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-black/5 flex flex-col gap-2.5">
                <span className="text-xs font-black text-var-ink uppercase tracking-wider block">Add Step Action</span>
                <div className="flex gap-2">
                  <select
                    value={newStepType}
                    onChange={(e) => {
                      setNewStepType(e.target.value);
                      setNewStepParam(e.target.value === 'system_action' ? 'mute' : '');
                    }}
                    className="flex-1 rounded-xl border border-black/5 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-var-ink outline-none"
                  >
                    {STEP_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  {newStepType === 'system_action' ? (
                    <select
                      value={newStepParam}
                      onChange={(e) => setNewStepParam(e.target.value)}
                      className="flex-1 rounded-xl border border-black/5 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-var-ink outline-none"
                    >
                      {SYSTEM_ACTIONS.map((sa) => (
                        <option key={sa.id} value={sa.id}>
                          {sa.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={newStepParam}
                      onChange={(e) => setNewStepParam(e.target.value)}
                      placeholder={STEP_TYPES.find((t) => t.id === newStepType)?.placeholder}
                      className="flex-1 rounded-xl border border-black/5 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-var-ink outline-none focus:border-[#007aff]"
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="bg-[#007aff] text-white px-3.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-var-ink">Macro Steps ({macroSteps.length})</span>
                {macroSteps.length === 0 ? (
                  <span className="text-xs text-gray-500 block text-center py-4 bg-black/5 rounded-2xl">
                    No steps added yet. Use the form above.
                  </span>
                ) : (
                  <div className="flex flex-col gap-2">
                    {macroSteps.map((step, idx) => {
                      const StepIcon = getStepIcon(step.type);
                      return (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-black/5 dark:bg-black/20 p-2.5 rounded-xl border border-black/5 gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="grid h-7 w-7 place-items-center bg-[#007aff]/10 text-[#007aff] rounded-lg shrink-0">
                              <StepIcon size={14} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <strong className="block text-[10px] font-black uppercase text-[#8c94a0] leading-none">
                                {STEP_TYPES.find((t) => t.id === step.type)?.label}
                              </strong>
                              <span className="block text-xs text-var-ink font-bold truncate">
                                {step.type === 'system_action'
                                  ? SYSTEM_ACTIONS.find((sa) => sa.id === step.param)?.label || step.param
                                  : step.param}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button type="button" onClick={() => handleMoveStep(idx, 'up')} disabled={idx === 0} className="p-1 rounded text-var-ink disabled:opacity-30">
                              <ArrowUp size={14} />
                            </button>
                            <button type="button" onClick={() => handleMoveStep(idx, 'down')} disabled={idx === macroSteps.length - 1} className="p-1 rounded text-var-ink disabled:opacity-30">
                              <ArrowDown size={14} />
                            </button>
                            <button type="button" onClick={() => handleRemoveStep(idx)} className="p-1 text-red-500 rounded">
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-black/5" style={{ flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="flex-1 bg-black/5 hover:bg-black/10 text-var-ink font-bold text-xs py-3 rounded-xl border border-black/5 active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMacro}
                className="flex-1 bg-[#007aff] text-white font-bold text-xs py-3 rounded-xl active:scale-95 shadow-md shadow-blue-500/10 transition-transform flex items-center justify-center gap-1.5"
              >
                <Save size={14} />
                <span>Save Macro</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
