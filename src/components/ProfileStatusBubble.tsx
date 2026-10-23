/**
 * Пиксельный бабл статуса: поднимается от правой части головы по диагонали
 * вправо-вверх. Хвост — ступенчатая «лесенка» из пикселей, входит в тело
 * бабла одним контуром. Только горизонтальные/вертикальные линии.
 */
export default function ProfileStatusBubble({ status }: { status: string }) {
  return (
    <div className="pointer-events-none absolute left-[85%] top-[-38%] z-20 aspect-[20/9] w-[10rem]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 200 90"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <path
          d="M44 4H188H192V8H196V12V52H196V56H192V60H188H88V68H64V76H40V84H8V76H24V68H48V60H44H40V56H36V52V12H36V8H40V4H44Z"
          fill="#f5f5f5"
          stroke="#000"
          strokeWidth="4"
          strokeLinejoin="miter"
        />
      </svg>
      <div className="absolute bottom-[35%] left-[19%] right-[3%] top-0.5 flex items-center justify-center">
        <span className="break-words text-center text-[0.75rem] font-bold uppercase leading-tight tracking-[0.02em] text-[#151515]">
          {status}
        </span>
      </div>
    </div>
  );
}
