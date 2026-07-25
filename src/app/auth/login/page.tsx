"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Ошибка сети. Попробуйте ещё раз.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-md p-8 bg-[var(--card)] rounded-lg border border-[var(--border)]">
        <h1 className="text-2xl font-bold text-[var(--text)] text-center mb-6">
          Вход на АлопецияКрафт
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Никнейм Minecraft
            </label>
            <input
              type="text"
              name="nickname"
              required
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[#7c3aed]"
              placeholder="Введите ваш ник"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Пароль
            </label>
            <input
              type="password"
              name="password"
              required
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:border-[#7c3aed]"
              placeholder="Введите пароль"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="mt-6 text-center text-[var(--text-muted)] text-sm">
          Нет аккаунта?{" "}
          <Link href="/auth/register" className="text-[#7c3aed] hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
