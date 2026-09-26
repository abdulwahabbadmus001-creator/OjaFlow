import { useMemo, useState } from 'react';
import { CircleAlert, Megaphone, X } from 'lucide-react';
import { productAnnouncement } from '../config/announcement';
import { useI18n } from '../lib/i18n';

function withinWindow(startAt: string, endAt: string) {
  const now = Date.now();
  const start = startAt ? new Date(startAt).getTime() : 0;
  const end = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY;
  return now >= start && now <= end;
}

export default function MaintenanceBanner() {
  const { tr } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  const visible = useMemo(
    () => productAnnouncement.enabled && withinWindow(productAnnouncement.startAt, productAnnouncement.endAt),
    []
  );

  if (!visible || dismissed) return null;

  return (
    <div className={`product-announcement ${productAnnouncement.type}`}>
      <div className="announcement-icon">
        {productAnnouncement.type === 'maintenance' ? <CircleAlert size={20} /> : <Megaphone size={20} />}
      </div>
      <div className="grow">
        <strong>{tr(productAnnouncement.title)}</strong>
        <span>{tr(productAnnouncement.message)}</span>
      </div>
      {productAnnouncement.dismissible && (
        <button type="button" aria-label={tr('Dismiss announcement')} onClick={() => setDismissed(true)}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}