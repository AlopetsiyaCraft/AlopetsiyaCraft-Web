#!/usr/bin/env bash
# Запускает Cloudflare quick tunnel и показывает ссылку в терминале.
# Использование: npm run tunnel
set -u

CLOUDFLARED="${CLOUDFLARED:-$HOME/.local/bin/cloudflared}"
if ! command -v "$CLOUDFLARED" >/dev/null 2>&1; then
  CLOUDFLARED="$(command -v cloudflared || true)"
fi
if [ -z "$CLOUDFLARED" ]; then
  echo "cloudflared не найден. Установи: brew install cloudflared" >&2
  exit 1
fi

PORT="${PORT:-3000}"
METRICS_PORT="${METRICS_PORT:-20243}"
LOG="${TUNNEL_LOG:-/tmp/alopetsiya-tunnel.log}"
URL_FILE="${TUNNEL_URL_FILE:-/tmp/alopetsiya-tunnel-url.txt}"

"$CLOUDFLARED" tunnel --url "http://localhost:$PORT" --no-autoupdate \
  --protocol http2 --metrics "127.0.0.1:$METRICS_PORT" --logfile "$LOG" &
PID=$!
trap 'kill "$PID" 2>/dev/null' EXIT INT TERM

for _ in $(seq 1 40); do
  URL=$(curl -s --max-time 2 "http://127.0.0.1:$METRICS_PORT/quicktunnel" 2>/dev/null \
    | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p')
  if [ -n "$URL" ]; then
    echo
    echo "=================================================="
    echo "  Telegram Web App URL:"
    echo "  https://$URL"
    echo "=================================================="
    echo
    echo "Ссылка сохранена в $URL_FILE"
    echo "Оставь это окно открытым. Ctrl+C — остановить туннель."
    echo
    echo "https://$URL" > "$URL_FILE"
    break
  fi
  sleep 1
done

if [ -z "${URL:-}" ]; then
  echo "Не удалось получить ссылку. Смотри лог: $LOG" >&2
fi

wait "$PID"
