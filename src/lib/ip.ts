/**
 * Нормализация IP для сессий Minecraft (мод AlopetsiyaAuth).
 *
 * Один и тот же игрок может заходить на сервер через разные представления
 * своего адреса, и тогда сессия «теряется» — игрока снова просят ввести /login:
 *
 *   26.80.76.48            — вход по IPv4 (Radmin VPN)
 *   fdfd:0:0:0:0:0:1a50:4c30 — тот же адрес в IPv6-форме Radmin
 *   127.0.0.1 / ::1        — localhost (клиент то берёт IPv4, то IPv6)
 *   ::ffff:26.80.76.48     — IPv4-mapped
 *
 * Мод присылает `InetAddress.getHostAddress()`, то есть «как получилось», без
 * приведения к общему виду. Здесь сводим все формы к одному каноническому
 * виду, чтобы сравнение в БД работало независимо от способа подключения.
 */

/** Сжимает 8 групп IPv6 в каноническую запись (длинный нулевой хвост -> `::`). */
function compressIpv6(groups: number[]): string {
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === 0) {
      if (curStart === -1) {
        curStart = i;
        curLen = 1;
      } else {
        curLen++;
      }
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
    }
  }

  // `::` имеет смысл только когда сжимает хотя бы две группы.
  if (bestLen < 2) bestStart = -1;

  const hex = groups.map((g) => g.toString(16));
  if (bestStart === -1) return hex.join(":");
  return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLen).join(":")}`;
}

/** 32 бита -> `a.b.c.d`. */
function bitsToIpv4(high: number, low: number): string {
  return `${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`;
}

function isZero(groups: number[], from: number, to: number): boolean {
  for (let i = from; i < to; i++) if (groups[i] !== 0) return false;
  return true;
}

/** Разбирает IPv6 (включая `::ffff:1.2.3.4`) в 8 групп по 16 бит. */
function parseIpv6(value: string): number[] | null {
  let text = value.toLowerCase();

  // Хвост вида `::ffff:127.0.0.1` приводим к двум hex-группам.
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const parts = tail.split(".");
    if (parts.length !== 4) return null;
    const nums: number[] = [];
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) return null;
      const n = Number(part);
      if (n > 255) return null;
      nums.push(n);
    }
    text =
      text.slice(0, lastColon + 1) +
      (((nums[0] << 8) | nums[1]) >>> 0).toString(16) +
      ":" +
      (((nums[2] << 8) | nums[3]) >>> 0).toString(16);
  }

  const gap = text.indexOf("::");
  let head: string[];
  let tailGroups: string[] | null = null;

  if (gap === -1) {
    head = text.split(":");
    if (head.length !== 8) return null;
  } else {
    if (text.indexOf("::", gap + 1) !== -1) return null;
    const left = text.slice(0, gap);
    const right = text.slice(gap + 2);
    head = left ? left.split(":") : [];
    tailGroups = right ? right.split(":") : [];
    // `::` должен означать хотя бы одну группу.
    if (head.length + tailGroups.length > 7) return null;
  }

  const groups: number[] = [];
  for (const raw of head) {
    if (!/^[0-9a-f]{1,4}$/.test(raw)) return null;
    groups.push(parseInt(raw, 16));
  }
  if (tailGroups) {
    for (let i = head.length + tailGroups.length; i < 8; i++) groups.push(0);
    for (const raw of tailGroups) {
      if (!/^[0-9a-f]{1,4}$/.test(raw)) return null;
      groups.push(parseInt(raw, 16));
    }
  }

  return groups.length === 8 ? groups : null;
}

function normalizeIpv6(groups: number[]): string {
  // ::ffff:a.b.c.d и fe80::/64 с ff:fe — это тот же IPv4-адрес.
  if (isZero(groups, 0, 5) && groups[5] === 0xffff) {
    return bitsToIpv4(groups[6], groups[7]);
  }
  // Loopback: ::1 и 127.0.0.1 — один и тот же компьютер.
  if (isZero(groups, 0, 7) && groups[7] === 1) return "127.0.0.1";
  // EUI-64 (fe80::/10): младшие 32 бита — MAC, из него обратно IPv4.
  if (groups[5] === 0xfffe) {
    return bitsToIpv4(groups[6] ^ 0xff, groups[7] ^ 0xff);
  }
  // Radmin VPN: префикс fdfd::/16, младшие 32 бита — сам IPv4-адрес.
  if (groups[0] === 0xfdfd && isZero(groups, 1, 6)) {
    return bitsToIpv4(groups[6], groups[7]);
  }

  return compressIpv6(groups);
}

/**
 * Приводит IP к каноническому виду. Нераспознанное значение возвращается
 * как есть (обрезанным по длине), чтобы не ломать текущее поведение.
 */
export function normalizeIp(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  let text = raw;
  // Форма `[::1]:25565` или `[::1]`.
  if (text.startsWith("[")) {
    const close = text.indexOf("]");
    if (close !== -1) text = text.slice(1, close);
  }
  // Zone id у link-local адресов: `fe80::1%12`.
  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (ipv4) {
    const nums = ipv4.slice(1).map(Number);
    if (nums.every((n) => n <= 255)) return nums.join(".");
    return text;
  }

  const groups = parseIpv6(text);
  return groups ? normalizeIpv6(groups) : text.toLowerCase();
}