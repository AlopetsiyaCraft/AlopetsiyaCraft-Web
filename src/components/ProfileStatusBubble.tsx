/**
 * Пиксельный бабл статуса как на референсе: крупные ступенчатые скругления
 * по углам, толстая чёрная рамка, короткий широкий хвост по центру вниз.
 * Бабл приподнят над правой частью головы, хвост заканчивается выше неё.
 * Только горизонтальные/вертикальные линии.
 */
export default function ProfileStatusBubble({ status }: { status: string }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-[88%] z-20 mb-1 aspect-[20/11] w-[8rem] -translate-x-1/2 sm:w-[10rem]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 160 88"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <path
          d="M20 4H140H144V8H148V12H152V16V48H152V52H148V56H144V60H140H88V66H84V72H80V76H76V72H72V66H68V60H20H16V56H12V52H8V48V16H8V12H12V8H16V4H20Z"
          fill="#f5f5f5"
          stroke="#000"
          strokeWidth="5"
          strokeLinejoin="miter"
        />
      </svg>
      <div className="absolute bottom-[34%] left-[8%] right-[8%] top-1 flex items-center justify-center">
        <span className="break-words text-center text-[0.8rem] font-bold uppercase leading-tight tracking-[0.02em] text-[#151515]">
          {status}
        </span>
      </div>
    </div>
  );
}
