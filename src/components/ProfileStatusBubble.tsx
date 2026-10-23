/**
 * Пиксельный бабл статуса справа от головы: поднимается по диагонали
 * вправо-вверх, а хвостик одним контуром перетекает в тело бабла.
 * Абсолютный — не участвует в раскладке и не двигает ник.
 */
export default function ProfileStatusBubble({ status }: { status: string }) {
  return (
    <div className="pointer-events-none absolute left-full top-[-0.35rem] z-20 ml-1 h-14 w-[13rem] sm:w-[14rem]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 240 64"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        style={{ filter: "drop-shadow(3px 3px 0 rgba(0,0,0,0.45))" }}
        aria-hidden
      >
        <path
          d="M12 4H228L234 10V42L228 48H46L30 60H14L10 48V10Z"
          fill="#f5f5f5"
          stroke="#000"
          strokeWidth="3"
          strokeLinejoin="miter"
        />
      </svg>
      <div className="absolute inset-x-2 bottom-[14px] top-1 flex items-center justify-center px-1">
        <span className="break-words text-center text-[0.68rem] font-bold uppercase leading-tight tracking-[0.02em] text-[#151515]">
          {status}
        </span>
      </div>
    </div>
  );
}
