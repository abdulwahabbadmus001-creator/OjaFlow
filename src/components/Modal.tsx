import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export default function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { tr } = useI18n();
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label={tr('Close')}><X size={20}/></button></div>
      {children}
    </section>
  </div>;
}
