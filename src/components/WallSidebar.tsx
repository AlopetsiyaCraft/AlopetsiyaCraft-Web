import Link from "next/link";
import type { AudioPreviewItem, FriendPreviewItem, PhotoPreviewItem } from "@/lib/wallPreview";

/** Заголовок блока: название + счётчик + ссылка «Все». */
function BlockHeader({
  title,
  count,
  href,
}: {
  title: string;
  count: number;
  href: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-3">
      <h2 className="text-sm font-semibold">
        {title}
        <span className="text-[var(--text-muted)] font-normal ml-1.5">{count}</span>
      </h2>
      <Link href={href} className="text-xs text-[#7c3aed] hover:underline shrink-0">
        Все
      </Link>
    </div>
  );
}

function MusicIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </svg>
  );
}

/** Блок «Аудио»: первые 5 треков (обложка + название), как превью во VK. */
function AudioBlock({
  tracks,
  total,
  baseHref,
}: {
  tracks: AudioPreviewItem[];
  total: number;
  baseHref: string;
}) {
  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <BlockHeader title="Аудио" count={total} href={`${baseHref}/music`} />
      <div className="flex flex-col">
        {tracks.map((t) => (
          <Link
            key={t.id}
            href={`${baseHref}/music`}
            className="flex items-center gap-3 py-2 -mx-2 px-2 rounded-lg hover:bg-[var(--bg)] transition-colors"
          >
            <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#7c3aed]/20 flex items-center justify-center text-[#7c3aed]">
              {t.coverUrl ? (
                <img src={t.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <MusicIcon />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              {t.artist && <div className="text-xs text-[var(--text-muted)] truncate">{t.artist}</div>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Блок «Фото»: 5-6 квадратиков последних фото. */
function PhotoBlock({
  photos,
  total,
  baseHref,
}: {
  photos: PhotoPreviewItem[];
  total: number;
  baseHref: string;
}) {
  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <BlockHeader title="Фото" count={total} href={`${baseHref}/foto`} />
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((p, i) => (
          <Link
            key={p.id}
            href={`${baseHref}/foto`}
            className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] block bg-[var(--bg)]"
          >
            <img src={p.url} alt={p.caption ?? "Фото"} loading="lazy" className="w-full h-full object-cover" />
            {i === photos.length - 1 && total > photos.length && (
              <span className="absolute inset-0 bg-black/60 text-white text-sm font-semibold flex items-center justify-center">
                +{total - photos.length}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Аватар друга: голова скина (как во VK) или первая буква ника. */
function FriendAvatar({
  skinUrl,
  nickname,
  size = 48,
}: {
  skinUrl: string | null;
  nickname: string;
  size?: number;
}) {
  if (skinUrl) {
    return (
      <div
        className="w-full aspect-square rounded-lg overflow-hidden bg-[#7c3aed]/20"
        style={{
          backgroundImage: `url(${skinUrl})`,
          backgroundSize: `${size * 4}px ${size * 4}px`,
          backgroundPosition: `-${size}px -${size}px`,
          imageRendering: "pixelated",
        }}
      />
    );
  }
  return (
    <div className="w-full aspect-square rounded-lg overflow-hidden bg-[#7c3aed]/20 flex items-center justify-center font-bold text-sm text-[var(--text-secondary)]">
      {nickname[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

/** Блок «Друзья»: сетка аватарок с никами. */
function FriendsBlock({
  friends,
  total,
  baseHref,
}: {
  friends: FriendPreviewItem[];
  total: number;
  baseHref: string;
}) {
  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <BlockHeader title="Друзья" count={total} href={`${baseHref}/friends`} />
      <div className="grid grid-cols-3 gap-x-2 gap-y-3">
        {friends.map((f) => (
          <Link
            key={f.id}
            href={`/profile/${encodeURIComponent(f.nickname)}`}
            className="flex flex-col items-center gap-1.5 min-w-0"
          >
            <div className="w-full">
              <FriendAvatar skinUrl={f.skinUrl} nickname={f.nickname} />
            </div>
            <span className="text-xs text-[var(--text-muted)] truncate w-full text-center">{f.nickname}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Правый сайдбар стены профиля (VK-стиль).
 * Блоки показываются только если контент есть: аудио (5), фото (6), друзья (6).
 */
export default function WallSidebar({
  baseHref,
  tracks,
  audioTotal,
  photos,
  photoTotal,
  friends,
  friendTotal,
}: {
  baseHref: string;
  tracks: AudioPreviewItem[];
  audioTotal: number;
  photos: PhotoPreviewItem[];
  photoTotal: number;
  friends: FriendPreviewItem[];
  friendTotal: number;
}) {
  return (
    <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
      {tracks.length > 0 && (
        <AudioBlock tracks={tracks.slice(0, 5)} total={audioTotal} baseHref={baseHref} />
      )}
      {photos.length > 0 && (
        <PhotoBlock photos={photos.slice(0, 6)} total={photoTotal} baseHref={baseHref} />
      )}
      {friends.length > 0 && (
        <FriendsBlock friends={friends.slice(0, 6)} total={friendTotal} baseHref={baseHref} />
      )}
    </aside>
  );
}