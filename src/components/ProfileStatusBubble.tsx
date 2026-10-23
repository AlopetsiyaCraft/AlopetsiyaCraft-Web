/**
 * Пиксельный бабл статуса: поднимается от правой части головы по диагонали
 * вправо-вверх. Хвост — ступенчатая «лесенка» из пикселей, входит в тело
 * бабла одним контуром. Только горизонтальные/вертикальные линии.
 */
export default function ProfileStatusBubble({ status }: { status: string }) {
  return (
    <div className="pointer-events-none absolute left-[68%] top-[-35%] z-20 aspect-[20/9] w-[11rem] sm:w-[12rem]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 200 90"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <path
          d="M32 4H188H192V8H196V12V52H196V56H192V60H188H84V68H60V76H40V84H20V76H28V68H48V60H32H28V56H24V52V12H24V8H28V4H32Z"
          fill="#f5f5f5"
          stroke="#000"
          strokeWidth="6"
          strokeLinejoin="miter"
        />
      </svg>
      <div className="absolute inset-x-[14%] bottom-[35%] top-1 flex items-center justify-center">
        <span className="break-words text-center text-[0.75rem] font-bold uppercase leading-tight tracking-[0.02em] text-[#151515]">
          {status}
        </span>
      </div>
    </div>
  );
}
