"use client";

import { useCallback, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import LiveChat, { type HeaderDragProps } from "./LiveChat";
import { useChatDock } from "@/lib/chat-dock";

const POSITION_KEY = "floatingChatPos";

interface Position {
  x: number;
  y: number;
}

function readSavedPosition(): Position | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Битые данные localStorage — игнорируем.
  }
  return null;
}

function clamp(value: number, limit: number) {
  return Math.min(Math.max(0, value), Math.max(limit, 0));
}

/**
 * Плавающее окно чата в правом нижнем углу — видно на всех страницах,
 * пока чат откреплён от главной (как сообщения во VK).
 * Окно можно перетаскивать за шапку (зажали левую кнопку и потянули);
 * позиция сохраняется в localStorage и переживает перезагрузку.
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
  // Плавающее окно не участвует в SSR (рендерится, только когда откреплено, а это
  // известно клиенту), поэтому сохранённую позицию можно читать сразу в инициализаторе.
  const [pos, setPos] = useState<Position | null>(readSavedPosition);
  const [dragging, setDragging] = useState(false);

  const updatePos = useCallback((next: Position) => {
    setPos(next);
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(next));
    } catch {
      // localStorage может быть недоступен — позиция тогда просто не сохранится.
    }
  }, []);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Только левая кнопка мыши.
      if (e.button !== 0) return;
      // Нажатие на кнопку в шапке — не перетаскивание: setPointerCapture перехватил бы
      // клик (click ушёл бы в общего предка целей down/up — в шапку), и кнопка
      // «закрепить/открепить» перестала бы нажиматься.
      const target = e.target as HTMLElement | null;
      if (target?.closest("button")) return;
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
      updatePos({ x: rect.left, y: rect.top });
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [updatePos]
  );

  const onHeaderPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      // Не начинаем перетаскивание, пока курсор не сдвинулся — иначе клик
      // (не по кнопке) тоже считался бы перетаскиванием.
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
      const x = clamp(d.origLeft + dx, window.innerWidth - w);
      const y = clamp(d.origTop + dy, window.innerHeight - h);
      updatePos({ x, y });
    },
    [updatePos]
  );

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