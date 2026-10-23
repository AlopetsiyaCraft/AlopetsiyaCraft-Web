/**
 * Пиксельный бабл статуса над головой — как на референсе:
 * прямоугольник со ступенчатыми (скруглёнными) углами, короткий
 * ступенчатый хвостик по центру вниз. Хвост заканчивается выше головы,
 * поэтому не залезает на неё. Только H/V линии.
 */
export default function ProfileStatusBubble({ status }: { status: string }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 aspect-[20/9] w-[8rem] -translate-x-1/2 sm:w-[10rem]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 200 90"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <path
          d="M24 4H176V8H180V12V48H180V52H176V56H118V64H112V72H106V78H94V72H88V64H82V56H24V52H20V48V12H20V8H24V4Z"
          fill="#f5f5f5"
          stroke="#000"
          strokeWidth="4"
          strokeLinejoin="miter"
        />
      </svg>
      <div className="absolute bottom-[38%] left-[12%] right-[12%] top-0.5 flex items-center justify-center">
        <span className="break-words text-center text-[0.8rem] font-bold uppercase leading-tight tracking-[0.02em] text-[#151515]">
          {status}
        </span>
      </div>
    </div>
  );
}
