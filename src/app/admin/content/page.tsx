import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getStaffUser } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  photoComments,
  photos,
  postComments,
  seasons,
  users,
  wallPosts,
} from "@/lib/db/schema";
import Header from "@/components/Header";
import AdminContent, {
  type AdminPhoto,
  type AdminPost,
  type AdminComment,
} from "@/components/AdminContent";

/** /admin/content — модерация стены, фото и комментариев. */
export default async function AdminContentPage() {
  const staff = await getStaffUser();
  if (!staff) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent("/admin/content")}`);
  }

  const [allSeasons, me, wallRows, photoRows, postCommentRows, photoCommentRows] =
    await Promise.all([
      db.select().from(seasons).orderBy(desc(seasons.number)).all(),
      db
        .select({ name: users.nickname, skinUrl: users.skinUrl, bld: users.bld })
        .from(users)
        .where(eq(users.id, staff.id))
        .get(),
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
        .limit(30)
        .all(),
      db
        .select({
          id: photos.id,
          fileName: photos.fileName,
          caption: photos.caption,
          createdAt: photos.createdAt,
          nickname: users.nickname,
        })
        .from(photos)
        .leftJoin(users, eq(photos.userId, users.id))
        .orderBy(desc(photos.createdAt))
        .limit(30)
        .all(),
      db
        .select({
          id: postComments.id,
          text: postComments.text,
          postId: postComments.postId,
          createdAt: postComments.createdAt,
          nickname: users.nickname,
        })
        .from(postComments)
        .leftJoin(users, eq(postComments.userId, users.id))
        .orderBy(desc(postComments.createdAt))
        .limit(30)
        .all(),
      db
        .select({
          id: photoComments.id,
          text: photoComments.text,
          photoId: photoComments.photoId,
          createdAt: photoComments.createdAt,
          nickname: users.nickname,
        })
        .from(photoComments)
        .leftJoin(users, eq(photoComments.userId, users.id))
        .orderBy(desc(photoComments.createdAt))
        .limit(30)
        .all(),
    ]);

  const posts: AdminPost[] = wallRows.map((row) => ({
    id: row.id,
    text: row.text,
    nickname: row.nickname ?? "unknown",
    createdAt: row.createdAt.toISOString(),
  }));
  const photoItems: AdminPhoto[] = photoRows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    caption: row.caption,
    nickname: row.nickname ?? "unknown",
    createdAt: row.createdAt.toISOString(),
  }));
  const postCommentItems: AdminComment[] = postCommentRows.map((row) => ({
    id: row.id,
    text: row.text,
    targetId: row.postId,
    nickname: row.nickname ?? "unknown",
    createdAt: row.createdAt.toISOString(),
  }));
  const photoCommentItems: AdminComment[] = photoCommentRows.map((row) => ({
    id: row.id,
    text: row.text,
    targetId: row.photoId,
    nickname: row.nickname ?? "unknown",
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Header
        seasons={allSeasons}
        user={me ? { name: me.name, skinUrl: me.skinUrl, bld: me.bld } : undefined}
        isLoggedIn
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mc-title text-3xl sm:text-4xl">Админка · модерация</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Последние записи, фото и комментарии. Удаление необратимо.
            </p>
          </div>
          <a href="/admin" className="mc-btn px-3 py-1.5 text-xs">
            ← В админку
          </a>
        </div>
        <AdminContent
          posts={posts}
          photos={photoItems}
          postComments={postCommentItems}
          photoComments={photoCommentItems}
        />
      </main>
    </div>
  );
}

export const metadata = {
  title: "Админка · модерация",
};
