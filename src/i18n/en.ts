/** 英文文案是所有 key 的来源；其他语言必须提供完全相同的 key（类型检查和单元测试会核对）。 */
const en = {
  "site.name": "To Do Mover",
  "site.title": "Export Microsoft To Do — backup & migrate before it shuts down",
  "site.description":
    "Export all your Microsoft To Do lists and tasks to JSON, CSV, Markdown, ICS, Todoist or Things. Runs entirely in your browser; your data never touches our servers.",

  "landing.news":
    "Microsoft To Do will be retired on June 30, 2027. Existing tasks will not be migrated automatically.",
  "landing.countdown": "{days} days left",
  "landing.headline": "Take your Microsoft To Do data with you",
  "landing.privacy":
    "Your data is processed only in your browser. It is sent to graph.microsoft.com and nowhere else.",
  "landing.signIn": "Sign in with Microsoft",
  "landing.demo": "Try the demo",
  "landing.importJson": "Open a previously exported JSON",
  "landing.noClientId": "Client ID not configured — demo mode only.",

  "app.title": "Export your tasks",
  "app.loading": "Loading…",
  "app.placeholder": "The export tool is under construction.",

  "footer.disclaimer":
    "This is an independent open-source project and is not affiliated with Microsoft. Microsoft To Do is a trademark of Microsoft.",
  "footer.source": "Source code",
  "footer.donate": "Buy me a coffee",
  "footer.language": "Language",

  "root.choose": "Choose your language",

  "notFound.title": "Page not found",
  "notFound.back": "Back to home",

  "auth.redirecting": "Completing sign-in…",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export default en satisfies Messages;
