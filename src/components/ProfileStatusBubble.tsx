/**
 * Пиксельный бабл статуса над головой — по референсу:
 * ступенчатые углы, белая заливка, толстая чёрная рамка и хвостик
 * строго по центру вниз, к голове. Все линии горизонтальные/вертикальные.
 * Абсолютный — не участвует в раскладке и не двигает ник.
 */
export default function ProfileStatusBubble({ status }: { status: string }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 aspect-[5/2] w-[8rem] -translate-x-1/2 sm:w-[9.5rem]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 200 80"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <path
          d="M12 4H188H192V8H196V12V48H196V52H192V56H188H116V64H112V68H108V72H106V76H94V72H92V68H88V64H84V56H12H8V52H4V48V12H4V8H8V4H12Z"
          fill="#f5f5f5"
          stroke="#000"
          strokeWidth="6"
          strokeLinejoin="miter"
        />
      </svg>
      <div className="absolute inset-x-2 bottom-[30%] top-1 flex items-center justify-center">
        <span className="break-words text-center text-[0.75rem] font-bold uppercase leading-tight tracking-[0.02em] text-[#151515]">
          {status}
        </span>
      </div>
    </div>
  );
}
