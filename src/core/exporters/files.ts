/** 由清单名生成文件名（SPEC 7 通用约定）。 */

// 文件系统非法字符 \/:*?"<>| 以及控制字符
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** 替换非法字符为 "_"，保留 emoji 和中文。 */
export function sanitizeFileName(name: string, fallback = "untitled"): string {
  let s = name.replace(ILLEGAL, "_").trim();
  // Windows 不允许文件名以点或空格结尾
  s = s.replace(/[. ]+$/, "");
  if (!s) s = fallback;
  if (WINDOWS_RESERVED.test(s)) s = `${s}_`;
  // 控制在常见文件系统 255 字节限制以内（给扩展名和序号留余量）
  while (new TextEncoder().encode(s).length > 200) s = Array.from(s).slice(0, -1).join("");
  return s;
}

/**
 * 返回一个生成不重名文件名的函数：第二次出现同名时追加 " (2)"，依此类推。
 * 比较时不区分大小写（Windows / macOS 默认文件系统不区分）。
 */
export function uniqueFileNamer(): (baseName: string, extension: string) => string {
  const used = new Set<string>();
  return (baseName, extension) => {
    const base = sanitizeFileName(baseName);
    let candidate = `${base}${extension}`;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) {
      candidate = `${base} (${n})${extension}`;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  };
}
