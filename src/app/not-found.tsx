import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mc-hero-bg force-dark flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mc-panel w-full max-w-md overflow-hidden">
        <div className="mc-grass-line" />
        <div className="p-8">
          <div className="mc-inset mx-auto mb-5 flex h-16 w-16 items-center justify-center">
            <span className="font-mono text-2xl text-[var(--mc-gold)]">404</span>
          </div>
          <h1 className="mc-title text-2xl">Страница не найдена</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Похоже, этот блок сломали крипером. Вернись на главную, там всё цело.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/" className="mc-btn mc-btn-primary">
              На главную
            </Link>
            <Link href="/stats" className="mc-btn">
              Статистика
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
