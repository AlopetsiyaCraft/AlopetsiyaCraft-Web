import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // На машине пользователя лежит лишний C:\Users\123\package-lock.json,
  // из-за которого Next неверно определяет корень проекта. Указываем явно.
  outputFileTracingRoot: path.resolve(process.cwd()),
  // Dev-сервер доступен и по локальной сети (Radmin/192.168.x.x) — без этого
  // Next блокирует HMR-соединения с не-Localhost origin.
  allowedDevOrigins: ["192.168.0.187", "26.80.76.48"],
};

export default nextConfig;