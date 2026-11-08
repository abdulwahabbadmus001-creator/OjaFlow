import BrandLogo from './BrandLogo';

export function RouteFallback({ label = 'Loading view…' }: { label?: string }) {
  return (
    <div
      className="route-fallback"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="route-spinner" aria-hidden="true" />
      <span className="route-fallback-label">{label}</span>
    </div>
  );
}

export function AppShellFallback({
  subtitle = 'Business command centre'
}: {
  subtitle?: string;
}) {
  return (
    <div className="premium-shell" role="status" aria-live="polite" aria-busy="true">
      <header className="premium-topbar">
        <div className="topbar-inner">
          <BrandLogo compact subtitle={subtitle} />
          <div className="topbar-actions" style={{ marginLeft: 'auto' }}>
            <div className="topbar-sync">
              <span>Ready</span>
            </div>
          </div>
        </div>
      </header>
      <main className="premium-main">
        <div className="content">
          <RouteFallback label="Opening workspace…" />
        </div>
      </main>
    </div>
  );
}

export default RouteFallback;
