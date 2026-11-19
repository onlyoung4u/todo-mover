/** 只在浏览器中使用的小工具（导出器和 core/ 里的代码不能用它们）。 */

/** 触发浏览器下载。 */
export function downloadFile(name: string, data: string | Uint8Array, mime: string) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  // 给浏览器留时间开始下载再释放
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Things 只有 macOS / iOS 版本（SPEC 7.6）。iPadOS 的 Safari 会伪装成 Mac，也算在内。 */
export function isAppleDevice(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || "";
  return (
    /mac|iphone|ipad|ipod|ios/i.test(platform) || /iPhone|iPad|iPod|Macintosh/.test(nav.userAgent)
  );
}

/** 可选的 IANA 时区列表，保证包含 UTC 和当前时区。 */
export function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    // 旧浏览器不支持，只给出当前时区和 UTC
  }
  return [...new Set(["UTC", current, ...zones])].sort((a, b) =>
    a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b),
  );
}
