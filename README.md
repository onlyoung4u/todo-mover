# To Do Mover

> Don't want to set anything up? Use the official site at **https://todo-mover.example.com**. No registration needed.<!-- TODO: replace with the production domain after launch -->

The Microsoft To Do apps will be retired on **June 30, 2027** (Microsoft retires the underlying service and APIs on separate, later dates). To Do Mover is a static web page: sign in with your Microsoft account and it reads all of your To Do data in the browser, then exports it as a lossless JSON backup and as CSV, Markdown, ICS, Todoist or Things files. **Your data never touches our servers.** It only travels between your browser and `graph.microsoft.com`.

> This is an independent open-source project and is not affiliated with Microsoft. Microsoft To Do is a trademark of Microsoft.

## Running locally

Requires Node.js 24 (see `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # optional: without a Client ID the site still runs, in demo mode only
npm run dev                  # http://localhost:4321
```

| Command                      | What it does                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                | Dev server (`astro dev`, port 4321)                                 |
| `npm test`                   | Unit tests (Vitest)                                                 |
| `npm run check`              | Type check (`astro check`)                                          |
| `npm run lint`               | ESLint                                                              |
| `npm run format`             | Format with Prettier                                                |
| `npm run build`              | Build the static site into `dist/`                                  |
| `npm run preview`            | Build, then serve it locally as a Worker with `wrangler dev` (8787) |
| `npm run fixtures:synthetic` | Regenerate the synthetic test fixture `src/fixtures/synthetic.json` |

> The Content Security Policy only applies to the built site, not to `astro dev`. Use `npm run preview` to check CSP.

## Environment variables

Injected at build time. Locally, put them in `.env.local` (not committed). All of them end up in the client-side JS, so none of them are secrets.

| Variable                    | Description                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_MSAL_CLIENT_ID`     | Application (client) ID of the Azure app. If empty, the sign-in button is disabled and only demo mode and JSON import work |
| `PUBLIC_SITE_URL`           | Site origin, used for canonical, hreflang and sitemap URLs. Defaults to `http://localhost:4321`                            |
| `PUBLIC_DONATE_URL_CN`      | Donation link shown in the Simplified Chinese UI                                                                           |
| `PUBLIC_DONATE_URL_GLOBAL`  | Donation link shown in all other languages                                                                                 |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Optional Cloudflare Web Analytics token                                                                                    |

The sign-in redirect URI needs no configuration: at runtime it is always `<current origin>/auth/redirect/`.

## Self-hosting

### 1. Register an Azure app

The official site's Azure app only allows the official domain as a redirect URI, so its Client ID won't work anywhere else. To self-host, register your own app:

1. Open https://portal.azure.com and go to **Microsoft Entra ID → App registrations → New registration**.
2. Under **Supported account types**, choose **Accounts in any organizational directory and personal Microsoft accounts**. Personal accounts must be included.
3. Under **Redirect URI**, choose the **Single-page application (SPA)** platform and enter `https://<your domain>/auth/redirect/`. For local development, also add `http://localhost:4321/auth/redirect/` and `http://localhost:8787/auth/redirect/`.
   - Register separate apps for development and production, and don't add localhost to the production app.
   - SPA redirect URIs don't support wildcards, so sign-in can't work on the random preview URLs Workers generates. Use demo mode there.
4. Copy the **Application (client) ID** into `PUBLIC_MSAL_CLIENT_ID`.
5. Under **API permissions**, add the Microsoft Graph **Delegated** permissions `Tasks.Read` and `User.Read`. Admin consent is not required.
6. Don't create a client secret. This is a browser-only app.

If sign-in fails with **AADSTS70002** ("must include a 'client_secret'") or **AADSTS9002326**, the redirect URI is registered under the **Web** platform. Remove it there and add it under **Single-page application** instead. **AADSTS50011** means the current address (for example `http://localhost:8787/auth/redirect/`) isn't registered yet.

### 2. Deploy to Cloudflare Workers (static assets)

The site is purely static and is served by Workers static assets with no Worker script, so requests are not billed as Worker invocations.

1. Your domain's DNS must be hosted on Cloudflare.
2. Replace the domain in `routes` in `wrangler.jsonc` (`todo-mover.example.com` is a placeholder).
3. Build with the target environment's variables, then deploy:

```bash
npm run build
npx wrangler deploy                 # production
npx wrangler deploy --env staging   # staging
```

Build **separately for each environment** with its own variables. Don't deploy the staging `dist/` to production.

### 3. GitHub Actions (optional)

`.github/workflows/ci.yml` runs the type check, ESLint, Prettier, unit tests and a build on every pull request. Pushes to `main` deploy to staging, and `v*` tags deploy to production. Deploy jobs are off by default. To turn them on, configure:

- Repository secrets: `CLOUDFLARE_API_TOKEN` (Workers deploy permission only) and `CLOUDFLARE_ACCOUNT_ID`
- Repository variable: `DEPLOY_ENABLED=true`
- Variables on the `staging` and `production` environments: the `PUBLIC_*` variables listed under [Environment variables](#environment-variables)

## Project structure

```
src/
  pages/          # Root language redirect, per-language landing pages, export tool, MSAL redirect page, 404
  layouts/        # Base.astro: lang, title, canonical, hreflang
  components/     # landing/ (static Astro components), app/ (React export tool)
  core/           # Plain TypeScript: Graph fetching, normalization, exporters (no React/Astro)
  i18n/           # UI strings (en, zh-CN, zh-TW)
  fixtures/       # Demo and test data (anonymized or synthetic, no real personal data)
  scripts/        # Small client-side scripts used by pages
scripts/          # Build-time tooling, e.g. the synthetic fixture generator
public/_headers   # Security response headers and cache rules
wrangler.jsonc    # Cloudflare Workers static assets config
```

## License

[AGPL-3.0](./LICENSE). You're free to deploy and modify it. If you run a modified version as a public service, you must publish its source code.
