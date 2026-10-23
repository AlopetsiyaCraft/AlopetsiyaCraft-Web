/**
 * Пиксельное облачко статуса над головой игрока — как в референсе:
 * прямоугольный бабл с чёрной рамкой и ступенчатым хвостиком вниз.
 * Абсолютное, поэтому не участвует в раскладке и не двигает ник.
 */
export default function ProfileStatusBubble({ status }: { status: string }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-5 w-max max-w-[8.5rem] -translate-x-1/2 sm:max-w-[12rem]">
      <div className="relative border-2 border-black bg-[#f5f5f5] px-3 py-2 text-center text-[0.65rem] font-bold uppercase leading-tight tracking-[0.02em] text-[#151515] shadow-[3px_3px_0_rgba(0,0,0,0.45)]">
        <span className="break-words">{status}</span>
      </div>

      {/* Ступенчатый хвостик вниз, к голове */}
      <svg
        className="absolute left-1/2 top-full h-4 w-8 -translate-x-1/2"
        viewBox="0 0 24 14"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <path
          d="M4 0H20V3H17V6H14V9H12V13H11V9H9V6H6V3H4Z"
          fill="#f5f5f5"
          stroke="#000"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
