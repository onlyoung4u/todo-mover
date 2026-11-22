# To Do Mover

> Don't want to set anything up? Use the official site at **https://todo-mover.alchemew.com**. No registration needed.

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

| Variable                    | Description                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_MSAL_CLIENT_ID`     | Application (client) ID of the Azure app. If empty, the sign-in button is disabled and only demo mode and JSON import work. Also generates the publisher-domain file below |
| `PUBLIC_SITE_URL`           | Site origin, used for canonical, hreflang and sitemap URLs. Defaults to `http://localhost:4321`                                                                            |
| `PUBLIC_DONATE_URL_CN`      | Donation link shown in the Simplified Chinese UI                                                                                                                           |
| `PUBLIC_DONATE_URL_GLOBAL`  | Donation link shown in all other languages                                                                                                                                 |
| `PUBLIC_CONTACT_EMAIL`      | Optional contact email shown on the privacy policy and terms pages (GitHub Issues is always listed)                                                                        |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Optional Cloudflare Web Analytics token                                                                                                                                    |
| `PUBLIC_NOINDEX`            | Set to `true` for staging / preview builds to emit `noindex, nofollow`, skip `sitemap-*.xml` & `llms*.txt`, and append `X-Robots-Tag` to `dist/_headers`                   |

The sign-in redirect URI needs no configuration: at runtime it is always `<current origin>/auth/redirect/`.

## Content & local preview

The export tool, page templates, structured data (JSON-LD), Open Graph tags, sitemap, and `llms*.txt` generators all live in this repository.

- **Public example content** (`src/content/`): ships a minimal FAQ and a short backup guide in all three languages so self-hosted builds work out of the box with complete SEO/GEO routes.
- **Official site content**: long-form migration guides and expanded FAQs are maintained in a separate private content repository and merged at build time. When `private-content/<collection>/` (`guides` or `faq`, each checked independently) contains at least one content file, it replaces `src/content/<collection>/` wholesale.

Local preview options:

- **Public examples only**: run `npm run dev` or `npm run preview`.
- **With private or custom content**: clone or place content directories (`guides/` and/or `faq/`) under `private-content/` (gitignored), or point `CONTENT_DIR` to another folder:

```bash
CONTENT_DIR=../todo-mover-content npm run dev
```

- **Local Cloudflare Workers preview**: run `npm run preview` (`public/_headers` is copied into `dist/_headers` automatically). Only temporarily copy a custom `wrangler.jsonc` if you need to verify production route fields, and do not commit it.

## Self-hosting

### 1. Register an Azure app

The official site's Azure app only allows the official domain as a redirect URI, so its Client ID won't work anywhere else. To self-host, register your own app:

1. Open https://portal.azure.com and go to **Microsoft Entra ID → App registrations → New registration**.
2. Under **Supported account types**, choose **Accounts in any organizational directory and personal Microsoft accounts**. Personal accounts must be included.
3. Under **Redirect URI**, choose the **Single-page application (SPA)** platform and enter `https://<your domain>/auth/redirect/`. For local development, also add `http://localhost:4321/auth/redirect/` and `http://localhost:8787/auth/redirect/`.
   - Register separate apps for development and production, and don't add localhost to the production app.
   - SPA redirect URIs don't support wildcards, so sign-in can't work on the random preview URLs Workers generates. Use demo mode there.
4. Copy the **Application (client) ID** into `PUBLIC_MSAL_CLIENT_ID`.
5. Under **API permissions**, add the Microsoft Graph **Delegated** permissions `User.Read`, `Tasks.Read` and `Tasks.ReadWrite`. Admin consent is not required. Sign-in only asks for `User.Read` and `Tasks.Read`; `Tasks.ReadWrite` is requested incrementally when a user chooses to read or download attachments, because Microsoft doesn't return attachments with read-only access. Listing it here lets an organization's admin approve everything at once.
6. Don't create a client secret. This is a browser-only app.
7. Optional, to set a **Publisher domain**: when `PUBLIC_MSAL_CLIENT_ID` is set, the build writes `/.well-known/microsoft-identity-association.json` declaring that app ID. After deploying, go to **Branding & properties → Publisher domain → Verify a new domain**, enter your site's domain and click **Verify and save domain**. You can verify each environment's own domain with the app built for it.

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

`.github/workflows/ci.yml` runs the type check, ESLint, Prettier, unit tests and a build on every pull request. Its deploy jobs (`preview`, `deploy-staging`, `deploy-production`) serve as a **self-hosting template** and are off by default (the official site is built and deployed from its private content repository, so this public repo holds no Cloudflare credentials). To turn them on in your own fork, configure:

- Repository secrets: `CLOUDFLARE_API_TOKEN` (Workers deploy permission only) and `CLOUDFLARE_ACCOUNT_ID`
- Repository variable: `DEPLOY_ENABLED=true`
- Variables on the `staging` and `production` environments: the `PUBLIC_*` variables listed under [Environment variables](#environment-variables) (`preview` and `deploy-staging` automatically set `PUBLIC_NOINDEX=true`)

## Project structure

```
src/
  pages/          # Root language redirect, landing, guides, FAQ, export tool, robots.txt, llms*.txt, MSAL redirect, 404
  layouts/        # Base.astro: lang, title, canonical, hreflang, OG / Twitter Card, PUBLIC_NOINDEX
  components/     # landing/ (static Astro components & JsonLd), app/ (React export tool)
  content/        # Minimal public example guides and FAQs (replaced by private-content/ when non-empty)
  content.config.ts # Content collection schemas and private-content/ fallback resolution
  lib/            # Content helpers, UTC date formatting, JSON-LD, llms*.txt, and build helpers
  core/           # Plain TypeScript: Graph fetching, normalization, exporters (no React/Astro)
  i18n/           # UI strings (en, zh-CN, zh-TW)
  fixtures/       # Demo and test data (anonymized or synthetic, no real personal data)
  scripts/        # Small client-side scripts used by pages
scripts/          # Build-time tooling, e.g. the synthetic fixture generator
public/_headers   # Security response headers and cache rules
wrangler.jsonc    # Cloudflare Workers static assets template config
```

## License

[AGPL-3.0](./LICENSE). You're free to deploy and modify it. If you run a modified version as a public service, you must publish its source code.
