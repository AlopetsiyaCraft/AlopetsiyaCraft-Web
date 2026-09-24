"use client";

import { useCallback, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import LiveChat, { type HeaderDragProps } from "./LiveChat";
import { useChatDock } from "@/lib/chat-dock";

/**
 * Плавающее окно чата в правом нижнем углу — видно на всех страницах,
 * пока чат откреплён от главной (как сообщения во VK).
 * Окно можно перетаскивать за шапку (зажали левую кнопку и потянули).
 */
export default function FloatingChat() {
  const { pinned } = useChatDock();
  const { data: session } = useSession();

  const windowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean; // стало true после перемещения курсора больше порога (4px)
  } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Только левая кнопка мыши.
    if (e.button !== 0) return;
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
      moved: false,
    };
    // Фиксируем позицию в left/top сразу, чтобы после перетаскивания
    // окно не прыгало обратно в правый нижний угол.
    setPos({ x: rect.left, y: rect.top });
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // Не начинаем перетаскивание, пока курсор не сдвинулся — иначе клик
    // по кнопке «закрепить» в шапке не сможет сработать как обычный клик.
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    const el = windowRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // Не даём окну улететь за пределы экрана.
    const x = Math.min(Math.max(0, d.origLeft + dx), window.innerWidth - w);
    const y = Math.min(Math.max(0, d.origTop + dy), window.innerHeight - h);
    setPos({ x, y });
  }, []);

  const onHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture мог уже сняться — игнорируем.
    }
  }, []);

  if (pinned) return null;

  const headerDragProps: HeaderDragProps = {
    onPointerDown: onHeaderPointerDown,
    onPointerMove: onHeaderPointerMove,
    onPointerUp: onHeaderPointerUp,
    dragging,
  };

  return (
    <div
      ref={windowRef}
      className="fixed z-50 w-[380px] max-w-[calc(100vw-2rem)]"
      style={pos ? { left: pos.x, top: pos.y } : { right: "1rem", bottom: "1rem" }}
    >
      <div className="rounded-lg shadow-2xl">
        <LiveChat isLoggedIn={!!session?.user} headerDragProps={headerDragProps} />
      </div>
    </div>
  );
}