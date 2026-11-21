interface ImportMetaEnv {
  /** Azure 应用的 Application (client) ID。未配置时只能使用演示模式。 */
  readonly PUBLIC_MSAL_CLIENT_ID?: string;
  /** 正式域名，用于 canonical、hreflang、sitemap。 */
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_DONATE_URL_CN?: string;
  readonly PUBLIC_DONATE_URL_GLOBAL?: string;
  /** 可选：Cloudflare Web Analytics 令牌。 */
  readonly PUBLIC_CF_ANALYTICS_TOKEN?: string;
  /** 设为 "true" 时开启整站防收录（预发 / PR 预览环境使用）。 */
  readonly PUBLIC_NOINDEX?: string;
  /** 可选：隐私政策与服务条款中显示的联系邮箱。 */
  readonly PUBLIC_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
