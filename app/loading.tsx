export default function Loading() {
  return (
    <main className="route-loading" aria-busy="true">
      <div className="route-loading-content">
        <span className="sr-only" role="status">正在載入頁面</span>
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-copy" />
        <div className="skeleton-card-grid">
          <div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" />
        </div>
        <div className="skeleton-card skeleton-table" />
      </div>
    </main>
  );
}
