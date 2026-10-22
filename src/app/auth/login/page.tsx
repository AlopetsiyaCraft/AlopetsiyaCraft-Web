"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Возврат после входа: /auth/login?callbackUrl=... (используется при
  // прерванной авторизации Discord, когда кука сессии не долетела).
  const [callbackUrl, setCallbackUrl] = useState("/");

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("callbackUrl");
    if (param && param.startsWith("/")) {
      setCallbackUrl(param);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const nickname = formData.get("nickname") as string;
      const password = formData.get("password") as string;

      const result = await signIn("credentials", {
        nickname,
        password,
        redirect: false,
      });

      setLoading(false);

      if (result?.error) {
        setError("Неверный никнейм или пароль");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Ошибка сети. Попробуйте ещё раз.");
      setLoading(false);
    }
  }

  return (
    <div className="mc-hero-bg force-dark flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-5 flex items-center gap-2.5">
        <span
          className="inline-block h-7 w-7 border-2 border-black"
          style={{ background: "linear-gradient(to bottom, #7dbb52 0 34%, #5d9c3c 34% 46%, #8b7355 46% 100%)" }}
          aria-hidden
        />
        <span className="mc-text-shadow text-lg font-bold uppercase tracking-[0.06em]">
          <span className="text-[var(--text)]">Алопеция</span>
          <span className="text-[var(--mc-green-light)]">Крафт</span>
        </span>
      </Link>

      <div className="mc-panel w-full max-w-md overflow-hidden">
        <div className="mc-grass-line" />
        <div className="mc-head justify-between">
          <span>Вход в аккаунт</span>
          <span className="mc-chip text-[0.58rem] text-[var(--text-muted)]">auth</span>
        </div>

        <div className="p-6 sm:p-7">
          <p className="mb-5 text-sm text-[var(--text-secondary)]">
            Войди, чтобы писать в чат, смотреть профиль и загружать скриншоты.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Никнейм Minecraft
              </label>
              <input
                type="text"
                name="nickname"
                required
                className="mc-input"
                placeholder="AlexMilash"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Пароль
              </label>
              <input
                type="password"
                name="password"
                required
                className="mc-input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="border-2 border-black bg-[rgba(214,69,69,0.18)] px-3 py-2 text-sm text-[var(--mc-red)]">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="mc-btn mc-btn-primary w-full py-2.5">
              {loading ? "Вход…" : "Войти"}
            </button>
          </form>

          <p className="mt-5 border-t-2 border-black/40 pt-4 text-center text-sm text-[var(--text-muted)]">
            Нет аккаунта?{" "}
            <Link href="/auth/register" className="font-semibold text-[var(--mc-green-light)] hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>

      <Link href="/" className="mt-5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]">
        ← На главную
      </Link>
    </div>
  );
}
