import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Megaphone, X } from 'lucide-react';
import { productAnnouncement } from '../config/announcement';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { scheduleDeferredTask } from '../lib/storage';
import type { SystemBroadcastItem } from '../types';

function withinWindow(startAt: string, endAt: string) {
  const now = Date.now();
  const start = startAt ? new Date(startAt).getTime() : 0;
  const end = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY;
  return now >= start && now <= end;
}

export default function MaintenanceBanner() {
  const { tr } = useI18n();
  const [dismissedId, setDismissedId] = useState<string>('');
  const [liveBroadcast, setLiveBroadcast] =
    useState<SystemBroadcastItem | null>(null);

  useEffect(() => {
    let active = true;
    async function checkBroadcast() {
      if (!navigator.onLine) return;
      try {
        const res = await api.activeBroadcast();
        if (active) {
          setLiveBroadcast(res.broadcast && res.broadcast.isActive ? res.broadcast : null);
        }
      } catch {
        /* ignore offline errors */
      }
    }
    const cancelInitial = scheduleDeferredTask(() => {
      void checkBroadcast();
    }, 900);
    const timer = window.setInterval(() => {
      void checkBroadcast();
    }, 20000);
    return () => {
      active = false;
      cancelInitial();
      window.clearInterval(timer);
    };
  }, []);

  const staticVisible = useMemo(
    () =>
      productAnnouncement.enabled &&
      withinWindow(productAnnouncement.startAt, productAnnouncement.endAt),
    []
  );

  if (liveBroadcast && liveBroadcast.isActive) {
    const bannerKey = `live:${liveBroadcast.id}:${liveBroadcast.updatedAt || ''}`;
    if (dismissedId === bannerKey) return null;
    return (
      <div className={`product-announcement ${liveBroadcast.kind}`}>
        <div className="announcement-icon">
          {liveBroadcast.kind === 'maintenance' ? (
            <CircleAlert size={20} />
          ) : (
            <Megaphone size={20} />
          )}
        </div>
        <div className="grow">
          <strong>{liveBroadcast.title}</strong>
          <span>{liveBroadcast.message}</span>
        </div>
        <button
          type="button"
          aria-label={tr('Dismiss announcement')}
          onClick={() => setDismissedId(bannerKey)}
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  if (!staticVisible || dismissedId === 'static') return null;

  return (
    <div className={`product-announcement ${productAnnouncement.type}`}>
      <div className="announcement-icon">
        {productAnnouncement.type === 'maintenance' ? (
          <CircleAlert size={20} />
        ) : (
          <Megaphone size={20} />
        )}
      </div>
      <div className="grow">
        <strong>{tr(productAnnouncement.title)}</strong>
        <span>{tr(productAnnouncement.message)}</span>
      </div>
      {productAnnouncement.dismissible && (
        <button
          type="button"
          aria-label={tr('Dismiss announcement')}
          onClick={() => setDismissedId('static')}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
