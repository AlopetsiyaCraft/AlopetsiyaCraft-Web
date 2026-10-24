import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { photos, seasons, users, wallPosts } from "@/lib/db/schema";
import Header from "@/components/Header";
import AdminContentEditor, {
  type EditablePhoto,
  type EditablePost,
} from "@/components/AdminContentEditor";

/** /admin/content — правка подписей фото, видимости и записей стены. */
export default async function AdminContentPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin/content")}`);
  }

  const [allSeasons, me, photoRows, postRows] = await Promise.all([
    db.select().from(seasons).orderBy(desc(seasons.number)).all(),
    db
      .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
      .from(users)
      .where(eq(users.id, admin.id))
      .get(),
    db
      .select({
        id: photos.id,
        fileName: photos.fileName,
        caption: photos.caption,
        visibility: photos.visibility,
        createdAt: photos.createdAt,
        nickname: users.nickname,
      })
      .from(photos)
      .leftJoin(users, eq(photos.userId, users.id))
      .orderBy(desc(photos.createdAt))
      .limit(15)
      .all(),
    db
      .select({
        id: wallPosts.id,
        text: wallPosts.text,
        createdAt: wallPosts.createdAt,
        nickname: users.nickname,
      })
      .from(wallPosts)
      .leftJoin(users, eq(wallPosts.userId, users.id))
      .orderBy(desc(wallPosts.createdAt))
      .limit(15)
      .all(),
  ]);

  const photoItems: EditablePhoto[] = photoRows.map((photo) => ({
    id: photo.id,
    fileName: photo.fileName,
    caption: photo.caption,
    visibility: photo.visibility,
    nickname: photo.nickname ?? "unknown",
    createdAt: photo.createdAt.toISOString(),
  }));
  const postItems: EditablePost[] = postRows.map((post) => ({
    id: post.id,
    text: post.text,
    nickname: post.nickname ?? "unknown",
    createdAt: post.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Админка · контент</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Подписи и видимость фото, текст записей стены. Ничего не удаляется.
            </p>
          </div>
          <Link href="/admin" className="mc-btn px-3 py-1.5 text-xs">
            ← В админку
          </Link>
        </div>

        <AdminContentEditor photos={photoItems} posts={postItems} />
      </main>
    </div>
  );
}

export const metadata = {
  title: "Админка · контент",
};
