"use client";

import { useMemo, useState } from "react";
import type { PhotoCommentItem, PostCommentItem } from "@/lib/profile";

type AnyComment = PhotoCommentItem | PostCommentItem;

function ruDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

interface CommentTreeProps {
  /** Плоский список комментариев (порядок: старшие раньше, ответы после родителей). */
  comments: AnyComment[];
  /** Ник залогиненного; null — поле ввода скрыто. */
  viewerNickname: string | null;
  /** Возвращает true при успехе — тогда ввод очищается. */
  onAddComment: (text: string, parentId: number | null) => Promise<boolean>;
  /** Подпись для незалогиненных гостей. */
  loginHint?: string;
}

interface Node {
  item: AnyComment;
  children: Node[];
}

/** Строит дерево из плоского списка (по parentId). */
function buildTree(comments: AnyComment[]): Node[] {
  const byId = new Map<number, Node>();
  for (const c of comments) byId.set(c.id, { item: c, children: [] });
  const roots: Node[] = [];
  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parentId != null && byId.has(c.parentId)) {
      byId.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Дерево комментариев «как в VK»: ответы вкладываются под родительский, видно кто кому пишет. */
export default function CommentTree({ comments, viewerNickname, onAddComment, loginHint }: CommentTreeProps) {
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<AnyComment | null>(null);
  const [sending, setSending] = useState(false);

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
    }
  }

  function renderNode(node: Node, depth: number) {
    const c = node.item;
    return (
      <div key={c.id} className={depth > 0 ? "ml-5 pl-3 border-l border-[var(--border)] pt-2 space-y-2" : "space-y-2"}>
        <div className="bg-[var(--bubble)] rounded-lg px-3 py-2">
          <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-xs">
            <a
              href={`/profile/${encodeURIComponent(c.authorNickname)}`}
              className="text-[#7c3aed] font-medium hover:underline"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = `/profile/${encodeURIComponent(c.authorNickname)}`;
              }}
            >
              {c.authorNickname}
            </a>
            {c.replyToNickname && c.parentId != null && (
              <span className="text-[var(--text-muted)]">
                <span className="text-[var(--text-secondary)]">→</span> @{c.replyToNickname}
              </span>
            )}
            {c.viewerIsAuthor && <span className="text-[#7c3aed]">· Вы</span>}
            <span className="text-[var(--text-muted)]">{ruDate(c.createdAt)}</span>
            <span className="text-[var(--text-muted)] ml-auto">
              {viewerNickname && (
                <button
                  onClick={() => {
                    if (replyingTo?.id === c.id) setReplyingTo(null);
                    else setReplyingTo(c);
                  }}
                  className={`hover:text-[#7c3aed] ${replyingTo?.id === c.id ? "text-[#7c3aed]" : ""}`}
                >
                  Ответить
                </button>
              )}
            </span>
          </div>
          <p className="text-sm mt-1 break-words whitespace-pre-wrap">{c.text}</p>
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        {tree.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">Комментариев пока нет</p>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      {viewerNickname ? (
        <form className="flex flex-col gap-2" onSubmit={submit}>
          {replyingTo && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5">
              <span>
                Ответ @{replyingTo.authorNickname}
                {replyingTo.text ? `: «${replyingTo.text.slice(0, 40)}${replyingTo.text.length > 40 ? "…" : ""}»` : ""}
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="ml-auto text-[var(--text-muted)] hover:text-red-400"
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
      ) : (
        loginHint && <p className="text-sm text-[var(--text-muted)]">{loginHint}</p>
      )}
    </div>
  );
}