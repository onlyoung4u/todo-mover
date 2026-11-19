/**
 * 距目标日期（含当天，按本地日历日计算）还剩多少天；已过期返回 0。
 * @param target "YYYY-MM-DD"
 */
export function daysUntil(target: string, now: Date = new Date()): number {
  const [y, m, d] = target.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${target}`);
  const end = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((end - today) / 86_400_000));
}
