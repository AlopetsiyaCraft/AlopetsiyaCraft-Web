export default function SeasonMapPage() {
  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold mb-6">3D Карта мира</h2>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">🗺️</div>
        <h3 className="text-xl font-semibold mb-2">Карта загружается...</h3>
        <p className="text-[var(--text-secondary)] mb-6">
          Здесь будет интерактивная 3D карта мира этого сезона.
          <br />
          Карта генерируется с помощью BlueMap.
        </p>
        <div className="inline-block px-4 py-2 bg-[var(--bg)] rounded text-sm text-[var(--text-muted)]">
          BlueMap экспортируется в папку /public/maps/season-X/
        </div>
      </div>
    </div>
  );
}
