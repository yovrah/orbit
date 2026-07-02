import { ClipboardPanel } from '../../control/ClipboardPanel';

export function ClipboardWidget() {
  return (
    <div className="w-flex-col">
      <div className="w-title-row">
        <span className="w-title">Clipboard</span>
      </div>
      <ClipboardPanel />
    </div>
  );
}
