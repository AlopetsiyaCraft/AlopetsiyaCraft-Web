"use client";

import { useMemo, useState } from "react";
import type { PhotoCommentItem, PostCommentItem } from "@/lib/profile";

type AnyComment = PhotoCommentItem | PostCommentItem;

/** Дата как в VK: «сегодня в 14:05», «вчера в 10:33», «22 сен в 9:43», «22 сен 2023 в 9:43». */
function vkDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString("ru-RU", { hour: "numeric", minute: "2-digit" });
  const month = d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
  if (d.toDateString() === now.toDateString()) return `сегодня в ${time}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `вчера в ${time}`;
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} ${month} в ${time}`;
  return `${d.getDate()} ${month} ${d.getFullYear()} в ${time}`;
}

/** Голова скина 32px (как в шапке), либо буковка, если скина нет. */
function CommentAvatar({ url, nickname }: { url: string | null; nickname: string }) {
  return (
    <a
      href={`/profile/${encodeURIComponent(nickname)}`}
      onClick={(e) => {
        e.preventDefault();
        window.location.href = `/profile/${encodeURIComponent(nickname)}`;
      }}
      className="w-8 h-8 shrink-0 rounded bg-[var(--hover)] overflow-hidden flex items-center justify-center text-sm font-bold"
      title={nickname}
    >
      {url ? (
        <div
          className="w-8 h-8"
          style={{
            backgroundImage: `url(${url})`,
            backgroundSize: "256px 256px",
            backgroundPosition: "-32px -32px",
            imageRendering: "pixelated",
          }}
        />
      ) : (
        <span className="text-[var(--text-secondary)]">{nickname[0]?.toUpperCase() ?? "?"}</span>
      )}
    </a>
  );
}

/** Мини-голова 16px (для тултипа «Оценили»). */
function MiniHead({ url, nickname }: { url: string | null; nickname: string }) {
  return (
    <div className="w-4 h-4 shrink-0 rounded-[3px] overflow-hidden bg-[var(--hover)] flex items-center justify-center text-[8px] font-bold">
      {url ? (
        <div
          className="w-4 h-4"
          style={{
            backgroundImage: `url(${url})`,
            backgroundSize: "128px 128px",
            backgroundPosition: "-16px -16px",
            imageRendering: "pixelated",
          }}
        />
      ) : (
        <span className="text-[var(--text-secondary)]">{nickname[0]?.toUpperCase() ?? "?"}</span>
      )}
    </div>
  );
}

/** Маленькая голова 24px (для плашки «Ответ @ник…» — меньше, чем в комментариях). */
function ReplyAvatar({ url, nickname }: { url: string | null; nickname: string }) {
  return (
    <div className="w-6 h-6 shrink-0 rounded overflow-hidden bg-[var(--hover)] flex items-center justify-center text-[10px] font-bold">
      {url ? (
        <div
          className="w-6 h-6"
          style={{
            backgroundImage: `url(${url})`,
            backgroundSize: "192px 192px",
            backgroundPosition: "-24px -24px",
            imageRendering: "pixelated",
          }}
        />
      ) : (
        <span className="text-[var(--text-secondary)]">{nickname[0]?.toUpperCase() ?? "?"}</span>
      )}
    </div>
  );
}

interface CommentTreeProps {
  /** Плоский список комментариев (порядок: старшие раньше, ответы после родителей). */
  comments: AnyComment[];
  /** Ник залогиненного; null — поле ввода скрыто. */
  viewerNickname: string | null;
  /** Возвращает true при успехе — тогда ввод очищается. */
  onAddComment: (text: string, parentId: number | null) => Promise<boolean>;
  /** Переключение лайка комментария; родитель сам обновляет свой список. */
  onToggleLike?: (commentId: number) => void;
  /** Подпись для незалогиненных гостей. */
  loginHint?: string;
  /**
   * Режим панели (лайтбокс): список скроллится в отдельной области без видимого
   * скроллбара, а форма ввода закреплена снизу (отделена чертой) и при клике
   * на поле раскрывается кнопками «Отмена» и «Отправить».
   */
  panel?: boolean;
  /** Заголовок над списком (для режима панели), напр. «Комментарии (3)». */
  listTitle?: string;
  /** Статус загрузки списка: loading — «Загрузка…», error — «Повторить», иначе пустое состояние. */
  status?: "loading" | "loaded" | "error";
  /** Повторная загрузка при status "error". */
  onRetry?: () => void;
}

interface Node {
  item: AnyComment;
  children: Node[];
}

/** Строит дерево из плоского списка (по parentId).
 *  Ветвится только один уровень: ответы на корневой комментарий. Ответы на ответы
 *  не углубляют дерево, а встают в ряд под этим же корневым комментарием
 *  (как в соцсетях: весь тред — один плоский уровень с @-упоминанием адресата). */
function buildTree(comments: AnyComment[]): Node[] {
  const byId = new Map<number, Node>();
  for (const c of comments) byId.set(c.id, { item: c, children: [] });
  const roots: Node[] = [];
  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parentId != null && byId.has(c.parentId)) {
      // Поднимаемся к корневому комментарию и вешаем ответ под него (плоский тред).
      let anchor = byId.get(c.parentId)!;
      while (anchor.item.parentId != null && byId.has(anchor.item.parentId)) {
        anchor = byId.get(anchor.item.parentId)!;
      }
      anchor.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function LikeButton({ c }: { c: AnyComment }) {
  const heart = (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill={c.likedByMe ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
  );
  return (
    <span className="relative group/like inline-flex">
      <span
        className={`inline-flex items-center gap-1.5 ${
          c.likedByMe ? "text-[#e13a56]" : "text-[var(--text-muted)]"
        }`}
      >
        {heart}
        {c.likeCount > 0 && <span className="text-xs font-medium">{c.likeCount}</span>}
      </span>
      {c.likeCount > 0 && (
        <span className="absolute bottom-full right-0 mb-1.5 z-30 hidden group-hover/like:block">
          <span className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg px-3 py-2 flex flex-col gap-1.5 min-w-44">
            <span className="text-xs text-[var(--text-muted)]">
              Оценили: <span className="text-[var(--text-secondary)]">{c.likeCount}</span>
            </span>
            <span className="flex flex-col gap-1">
              {c.likers.slice(-5).reverse().map((l) => (
                <span key={l.nickname} className="flex items-center gap-1.5 text-xs">
                  <MiniHead url={l.skinUrl} nickname={l.nickname} />
                  <a
                    href={`/profile/${encodeURIComponent(l.nickname)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/profile/${encodeURIComponent(l.nickname)}`;
                    }}
                    className="text-[var(--text-secondary)] hover:text-[#7c3aed]"
                  >
                    {l.nickname}
                  </a>
                </span>
              ))}
            </span>
            {c.likeCount > 5 && (
              <span className="text-xs text-[var(--text-muted)]">и ещё {c.likeCount - 5}</span>
            )}
          </span>
        </span>
      )}
    </span>
  );
}

/** Комментарии как в VK: аватар+имя, текст, ниже дата/ответ/лайк; ответы вкладываются деревом. */
export default function CommentTree({
  comments,
  viewerNickname,
  onAddComment,
  onToggleLike,
  loginHint,
  panel = false,
  status = "loaded",
  listTitle,
  onRetry,
}: CommentTreeProps) {
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<AnyComment | null>(null);
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);

  const tree = useMemo(() => buildTree(comments), [comments]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const ok = await onAddComment(t, replyingTo?.id ?? null);
    setSending(false);
    if (ok) {
      setText("");
      setReplyingTo(null);
      setFocused(false);
    }
  }

  /** «Отмена» в режиме поля сверху: сворачивает форму и чистит ответ/текст. */
  function cancelComment() {
    setText("");
    setReplyingTo(null);
    setFocused(false);
  }

  function renderNode(node: Node, depth: number) {
    const c = node.item;
    return (
      <div
        key={c.id}
        className={depth > 0 ? "ml-9 pl-1.5 flex flex-col gap-3" : "flex flex-col gap-3"}
      >
        <div className="group/comment flex gap-2.5">
          <CommentAvatar url={c.authorSkinUrl} nickname={c.authorNickname} />
          <div className="flex-1 min-w-0">
            {/* Строка 1: имя (аватар слева от него) */}
            <div className="flex items-center gap-x-1.5 flex-wrap">
              <a
                href={`/profile/${encodeURIComponent(c.authorNickname)}`}
                className="text-sm font-medium text-[var(--text)] hover:text-[#7c3aed]"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `/profile/${encodeURIComponent(c.authorNickname)}`;
                }}
              >
                {c.authorNickname}
              </a>
              {c.replyToNickname && c.parentId != null && (
                <span className="text-xs text-[var(--text-muted)]">
                  <span className="text-[var(--text-secondary)]">→</span> @{c.replyToNickname}
                </span>
              )}
              {c.viewerIsAuthor && <span className="text-xs text-[#7c3aed]">· Вы</span>}
            </div>
            {/* Строка 2: текст */}
            <p className="text-sm mt-0.5 break-words whitespace-pre-wrap">{c.text}</p>
            {/* Строка 3: дата, ответить, лайк */}
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-1 text-xs">
              <span className="text-[var(--text-muted)]">{vkDate(c.createdAt)}</span>
              {viewerNickname && (
                <button
                  onClick={() => {
                    if (replyingTo?.id === c.id) setReplyingTo(null);
                    else setReplyingTo(c);
                  }}
                  className={`text-[var(--text-muted)] hover:text-[#7c3aed] ${
                    replyingTo?.id === c.id ? "text-[#7c3aed]" : ""
                  }`}
                >
                  Ответить
                </button>
              )}
              {viewerNickname && onToggleLike && (
                <span
                  className={`cursor-pointer inline-flex ml-auto transition-opacity duration-200 ${
                    c.likeCount > 0 ? "opacity-100" : "opacity-0 group-hover/comment:opacity-100"
                  }`}
                  onClick={() => onToggleLike(c.id)}
                  title={c.likedByMe ? "Убрать оценку" : "Оценить"}
                >
                  <LikeButton c={c} />
                </span>
              )}
            </div>
          </div>
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className={panel ? "flex flex-col min-h-0 h-full" : "flex flex-col gap-3"}>
      {listTitle && (
        <h3 className={`text-sm font-semibold mb-2 shrink-0 ${panel ? "px-5 pt-3" : ""}`}>{listTitle}</h3>
      )}

      {/* Список (в панели — отдельная скроллируемая область без видимого скроллбара) */}
      <div className={panel ? "flex-1 min-h-0 overflow-y-auto no-scrollbar px-5" : "space-y-3"}>
        {tree.length === 0 ? (
          status === "loading" ? (
            <p className="text-[var(--text-muted)] text-sm">Загрузка…</p>
          ) : status === "error" ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              Не удалось загрузить комментарии
              <button
                type="button"
                onClick={onRetry}
                className="text-[#7c3aed] hover:underline shrink-0"
              >
                Повторить
              </button>
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-sm">Комментариев пока нет</p>
          )
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      {/* Ввод */}
      {viewerNickname ? (
        panel ? (
          <>
            {replyingTo && (
              <div className="shrink-0 flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 mx-5 my-3">
                <ReplyAvatar url={replyingTo.authorSkinUrl} nickname={replyingTo.authorNickname} />
                <span className="min-w-0">
                  Ответ <span className="text-[var(--text)] font-medium">@{replyingTo.authorNickname}</span>
                  {replyingTo.text ? `: «${replyingTo.text.slice(0, 40)}${replyingTo.text.length > 40 ? "…" : ""}»` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="ml-auto shrink-0 text-[var(--text-muted)] hover:text-red-400"
                  title="Отменить ответ"
                >
                  ✕
                </button>
              </div>
            )}
            {/* Полоса ввода: высота ровно как у нижнего блока под фото, черта — на одном уровне с ним */}
            <form className="shrink-0 h-14 border-t border-[var(--border)] flex items-center gap-2 px-5" onSubmit={submit}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setFocused(true)}
                maxLength={500}
                placeholder={replyingTo ? `Ответить ${replyingTo.authorNickname}…` : "Написать комментарий…"}
                className="flex-1 min-w-0 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#7c3aed]"
              />
              {focused && (
                <>
                  <button
                    type="button"
                    onClick={cancelComment}
                    className="px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg transition-colors shrink-0 whitespace-nowrap"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    className="px-3.5 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg disabled:opacity-50 shrink-0 whitespace-nowrap"
                  >
                    {sending ? "…" : "Отправить"}
                  </button>
                </>
              )}
            </form>
          </>
        ) : (
          <form className="mt-0.5 flex flex-col gap-2" onSubmit={submit}>
            {replyingTo && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5">
                <ReplyAvatar url={replyingTo.authorSkinUrl} nickname={replyingTo.authorNickname} />
                <span className="min-w-0">
                  Ответ <span className="text-[var(--text)] font-medium">@{replyingTo.authorNickname}</span>
                  {replyingTo.text ? `: «${replyingTo.text.slice(0, 40)}${replyingTo.text.length > 40 ? "…" : ""}»` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="ml-auto shrink-0 text-[var(--text-muted)] hover:text-red-400"
                  title="Отменить ответ"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                placeholder={replyingTo ? `Ответить ${replyingTo.authorNickname}…` : "Написать комментарий…"}
                className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[#7c3aed]"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg disabled:opacity-50"
              >
                {sending ? "…" : "Отправить"}
              </button>
            </div>
          </form>
        )
      ) : (
        loginHint &&
        (panel ? (
          <p className="shrink-0 text-sm text-[var(--text-muted)] mt-2">{loginHint}</p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">{loginHint}</p>
        ))
      )}
    </div>
  );
}