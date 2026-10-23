/**
 * Пиксельное облачко статуса, привязанное к голове игрока.
 * Абсолютное — не участвует в раскладке, поэтому ник не смещается
 * в зависимости от наличия статуса.
 */
export default function ProfileStatusBubble({ status }: { status: string }) {
  return (
    <div className="pointer-events-none absolute left-full top-2 z-20 ml-2 w-max max-w-[min(18rem,calc(100vw-9rem))]">
      <div className="relative border-2 border-black bg-[#ececec] px-3 py-2 text-sm leading-snug text-[#1b1b1b] shadow-[3px_3px_0_rgba(0,0,0,0.45)]">
        {/* Ступенчатый хвостик к голове */}
        <svg
          className="absolute -left-3 top-1 h-5 w-4"
          viewBox="0 0 16 20"
          shapeRendering="crispEdges"
          aria-hidden
        >
          <path
            d="M16 1H9v4H5v4H1v4h4v4h4v3h7z"
            fill="#ececec"
            stroke="#000"
            strokeWidth="2"
          />
        </svg>
        <span className="relative break-words">{status}</span>
      </div>
    </div>
  );
}
