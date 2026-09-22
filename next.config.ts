import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // На машине пользователя лежит лишний C:\Users\123\package-lock.json,
  // из-за которого Next неверно определяет корень проекта. Указываем явно.
  outputFileTracingRoot: path.resolve(process.cwd()),
};

export default nextConfig;