import { PackagePlus, ReceiptText, WalletCards, X } from 'lucide-react';
import type { AppSection } from '../types';
import { useI18n } from '../lib/i18n';

export default function QuickAction({
  onClose,
  onNavigate
}: {
  onClose: () => void;
  onNavigate: (section: AppSection) => void;
}) {
  const { tr } = useI18n();

  return (
    <div className="quick-sheet-backdrop" onMouseDown={event => event.currentTarget === event.target && onClose()}>
      <div className="quick-sheet">
        <div className="modal-head">
          <div>
            <span className="eyebrow">{tr('Quick action').toUpperCase()}</span>
            <h2>{tr('What do you want to record?')}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={tr('Close')}><X /></button>
        </div>

        <div className="quick-grid">
          <button onClick={() => { onNavigate('sales'); onClose(); }}>
            <span><ReceiptText /></span>
            <strong>{tr('Record sale')}</strong>
            <small>{tr('Money coming in')}</small>
          </button>
          <button onClick={() => { onNavigate('sales'); onClose(); }}>
            <span><WalletCards /></span>
            <strong>{tr('Add expense')}</strong>
            <small>{tr('Money going out')}</small>
          </button>
          <button onClick={() => { onNavigate('inventory'); onClose(); }}>
            <span><PackagePlus /></span>
            <strong>{tr('Add product')}</strong>
            <small>{tr('Update your stock')}</small>
          </button>
        </div>
      </div>
    </div>
  );
}
