# To Do 搬家 · To Do Mover

> 不想折腾？直接使用官方站点 **https://todo-mover.example.com** ，无需注册任何东西。<!-- TODO: 上线后替换为正式域名 -->

Microsoft To Do 将于 **2027-06-30** 停止服务。这是一个纯前端网页：用微软账号登录后，在浏览器本地读出 To Do 的全部数据，导出为完整备份（JSON）以及 CSV、Markdown、ICS、Todoist、Things 等格式。**数据不经过任何服务器**，只在你的浏览器和 `graph.microsoft.com` 之间传输。

_Export your Microsoft To Do lists and tasks before the service shuts down — entirely in your browser._

> 本工具为第三方开源项目，与 Microsoft 无关。Microsoft To Do 是 Microsoft 的商标。

## 本地运行

需要 Node.js 24（见 `.nvmrc`）。

```bash
npm install
cp .env.example .env.local   # 可选：不填 Client ID 也能运行，只是只能用演示模式
npm run dev                  # http://localhost:4321
```

| 命令                         | 作用                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `npm run dev`                | 开发服务器（`astro dev`，端口 4321）                           |
| `npm test`                   | 单元测试（Vitest）                                             |
| `npm run check`              | 类型检查（`astro check`）                                      |
| `npm run lint`               | ESLint                                                         |
| `npm run format`             | Prettier 格式化                                                |
| `npm run build`              | 构建静态站点到 `dist/`                                         |
| `npm run preview`            | 构建后用 `wrangler dev` 以 Workers 方式在本地访问（端口 8787） |
| `npm run fixtures:synthetic` | 重新生成合成测试数据 `src/fixtures/synthetic.json`             |

> 内容安全策略（CSP）只在构建产物中生效，`astro dev` 下不生效。检查 CSP 请用 `npm run preview`。

## 环境变量

构建时注入，本地放在 `.env.local`（不提交）。这些值都会出现在前端 JS 里，本来就是公开的。

| 变量                        | 说明                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `PUBLIC_MSAL_CLIENT_ID`     | Azure 应用的 Application (client) ID。留空时登录按钮置灰，只能用演示模式和 JSON 离线重导 |
| `PUBLIC_SITE_URL`           | 站点地址，用于 canonical、hreflang、sitemap。留空时为 `http://localhost:4321`            |
| `PUBLIC_DONATE_URL_CN`      | 打赏链接（简体中文界面显示）                                                             |
| `PUBLIC_DONATE_URL_GLOBAL`  | 打赏链接（其他语言显示）                                                                 |
| `PUBLIC_CF_ANALYTICS_TOKEN` | 可选，Cloudflare Web Analytics 令牌                                                      |

登录回调地址不用配置，运行时固定为 `<当前域名>/auth/redirect/`。

## 自部署

### 1. 注册 Azure 应用

官方站点的 Azure 应用只登记了官方域名，别人复制 Client ID 也无法在其他域名登录。自部署需要注册自己的应用：

1. 打开 https://portal.azure.com ，进入 **Microsoft Entra ID → App registrations → New registration**。
2. **Supported account types** 选 **Accounts in any organizational directory and personal Microsoft accounts**（必须包含个人账号）。
3. **Redirect URI** 平台选 **Single-page application (SPA)**，填 `https://<你的域名>/auth/redirect/`。本地开发再加上 `http://localhost:4321/auth/redirect/` 和 `http://localhost:8787/auth/redirect/`。
   - 建议开发与正式环境分开注册两个应用，正式应用不登记 localhost。
   - SPA 回调地址不支持通配符，所以 Workers 自动生成的随机预览地址无法登录，只能测试演示模式。
4. 复制 **Application (client) ID**，填入 `PUBLIC_MSAL_CLIENT_ID`。
5. **API permissions** 添加 Microsoft Graph 的 **Delegated** 权限 `Tasks.Read` 和 `User.Read`（不需要管理员同意）。
6. 不要创建 client secret（这是纯前端应用）。

### 2. 部署到 Cloudflare Workers（静态资源托管）

站点是纯静态文件，用 Workers 的 `assets` 托管，没有 Worker 脚本，静态请求不计费。

1. 域名的 DNS 托管在 Cloudflare 上。
2. 修改 `wrangler.jsonc` 中 `routes` 的域名（`todo-mover.example.com` 是占位符）。
3. 用目标环境的变量构建并部署：

```bash
npm run build
npx wrangler deploy                 # 正式环境
npx wrangler deploy --env staging   # 预发环境
```

每个环境都要用自己的变量**单独构建一次**，不要把预发的 `dist/` 直接部署到正式环境。

### 3. GitHub Actions（可选）

`.github/workflows/ci.yml` 在每个 PR 上运行类型检查、ESLint、Prettier、单元测试和构建；推送到 `main` 部署预发，推送 `v*` tag 部署正式环境。部署步骤默认关闭，需要配置：

- 仓库 Secrets：`CLOUDFLARE_API_TOKEN`（只授予 Workers 部署权限）、`CLOUDFLARE_ACCOUNT_ID`
- 仓库 Variables：`DEPLOY_ENABLED=true`
- Environments `staging` 和 `production` 各自的 Variables：上面「环境变量」一节中的 `PUBLIC_*`

## 项目结构

```
src/
  pages/          # 根语言跳转页、各语言落地页、导出工具页、MSAL 回调页、404
  layouts/        # Base.astro：lang、title、canonical、hreflang
  components/     # landing/（静态 Astro 组件）、app/（React 导出工具）
  core/           # 纯 TypeScript 逻辑：Graph 读取、模型归一化、导出器（不依赖 React/Astro）
  i18n/           # 文案（en、zh-CN、zh-TW）
  fixtures/       # 演示与测试数据（已脱敏 / 合成，不含真实个人信息）
  scripts/        # 页面上的小段客户端脚本
public/_headers   # 安全响应头与缓存策略
wrangler.jsonc    # Cloudflare Workers 静态资源配置
```

## 许可证

[AGPL-3.0](./LICENSE)。可以自由部署和修改；修改后对外提供服务的，必须公开源码。
