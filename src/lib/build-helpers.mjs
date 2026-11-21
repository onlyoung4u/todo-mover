// @ts-check

/**
 * 判断环境变量是否开启整站防收录（PUBLIC_NOINDEX=true）。
 * @param {string | undefined} value
 * @returns {boolean}
 */
export function isNoindexEnv(value) {
  return value?.trim().toLowerCase() === "true";
}

/**
 * 站点地图 URL 过滤器：
 * 收录各语言落地页（/<lang>/）、指南列表页（/<lang>/guides/）、指南详情页（/<lang>/guides/<slug>/）与 FAQ 页（/<lang>/faq/）；
 * 排除根路径 /、/404/、/<lang>/app/、/auth/ 及其他非收录页面。
 *
 * @param {string} pageUrl
 * @param {readonly string[]} localeKeys
 * @returns {boolean}
 */
export function isIndexableSitemapUrl(pageUrl, localeKeys) {
  const pathname = new URL(pageUrl).pathname;
  const escapedLocales = localeKeys.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`^\\/(?:${escapedLocales})\\/(?:$|faq\\/$|guides\\/(?:[^/]+\\/)?$)`);
  return pattern.test(pathname);
}

const NOINDEX_HEADER_LINE = "  X-Robots-Tag: noindex, nofollow";

/**
 * 在 Cloudflare `_headers` 的 `/*` 规则下追加 `X-Robots-Tag: noindex, nofollow`，
 * 用于预发与 PR 预览环境兜底覆盖所有静态资源（HTML、文本、图片等）。
 *
 * @param {string} content
 * @returns {string}
 */
export function injectNoindexHeader(content) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);

  const rootIndex = lines.findIndex((line) => line.trim() === "/*");
  if (rootIndex === -1) {
    throw new Error("Could not find '/*' rule block in _headers");
  }

  let insertAt = rootIndex + 1;
  while (insertAt < lines.length && /^[ \t]+\S/.test(lines[insertAt])) {
    if (/^[ \t]+x-robots-tag[ \t]*:/i.test(lines[insertAt])) {
      return content;
    }
    insertAt++;
  }

  lines.splice(insertAt, 0, NOINDEX_HEADER_LINE);
  return lines.join(eol);
}
