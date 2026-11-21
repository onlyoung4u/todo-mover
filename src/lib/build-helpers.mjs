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
 * 收录各语言落地页（/<lang>/）、指南列表页（/<lang>/guides/）、指南详情页（/<lang>/guides/<slug>/）、FAQ 页（/<lang>/faq/）
 * 以及隐私政策（/<lang>/privacy/）与服务条款（/<lang>/terms/）；
 * 排除根路径 /、/404/、/<lang>/app/、/auth/ 及其他非收录页面。
 *
 * @param {string} pageUrl
 * @param {readonly string[]} localeKeys
 * @returns {boolean}
 */
export function isIndexableSitemapUrl(pageUrl, localeKeys) {
  const pathname = new URL(pageUrl).pathname;
  const escapedLocales = localeKeys.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(
    `^\\/(?:${escapedLocales})\\/(?:$|faq\\/$|privacy\\/$|terms\\/$|guides\\/(?:[^/]+\\/)?$)`,
  );
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

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Microsoft Entra 发布者域名验证文件 `/.well-known/microsoft-identity-association.json` 的内容。
 * 由构建时的 PUBLIC_MSAL_CLIENT_ID 生成，每个环境（含自部署）只声明自己的 Azure 应用；
 * 未配置时返回 undefined（不生成文件）。格式错误时直接报错，避免发布一个必然验证失败的文件。
 *
 * @param {string | undefined} clientId
 * @returns {string | undefined}
 */
export function identityAssociationJson(clientId) {
  const id = clientId?.trim();
  if (!id) return undefined;
  if (!GUID.test(id)) {
    throw new Error(`PUBLIC_MSAL_CLIENT_ID is not a GUID: ${JSON.stringify(id)}`);
  }
  return `${JSON.stringify({ associatedApplications: [{ applicationId: id.toLowerCase() }] }, null, 2)}\n`;
}
