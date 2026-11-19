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

  "export.json.label": "JSON backup",
  "export.json.targets":
    "A lossless backup. Open it here again later to convert it to any format, even after Microsoft To Do shuts down.",
  "export.json.losses": "Nothing. Attachments are saved as separate files.",
  "export.csv.label": "CSV spreadsheet",
  "export.csv.targets": "Excel, Numbers, Google Sheets, Notion",
  "export.csv.losses":
    "Note formatting. Steps, links and repeat rules become plain text; attachments are not included.",
  "export.markdown.label": "Markdown",
  "export.markdown.targets": "Obsidian (Tasks plugin), Logseq, Notion, any notes app",
  "export.markdown.losses": "Reminder times, step completion times, attachments",

  "export.ics.label": "ICS calendar tasks",
  "export.ics.targets": "Thunderbird, Nextcloud Tasks, and other CalDAV task apps",
  "export.ics.losses":
    "Note formatting; steps and links are added to the description. Attachments are not included.",
  "export.todoist.label": "Todoist CSV",
  "export.todoist.targets": "Todoist (one project per list)",
  "export.todoist.losses":
    "Completed tasks and checked steps (skipped by default), start dates, reminders, attachments. Todoist only supports p1 and p4 here.",
  "export.things.label": "Things 3",
  "export.things.targets": "Things 3 on Mac, iPhone and iPad",
  "export.things.losses":
    "Repeat rules, reminders and start dates are added to the notes. Tags that don't already exist in Things are dropped. Attachments are not included.",

  "csv.col.list": "List",
  "csv.col.title": "Title",
  "csv.col.status": "Status",
  "csv.col.importance": "Importance",
  "csv.col.due": "Due date",
  "csv.col.start": "Start date",
  "csv.col.reminder": "Reminder",
  "csv.col.recurrence": "Repeat",
  "csv.col.completed": "Completed date",
  "csv.col.created": "Created",
  "csv.col.modified": "Modified",
  "csv.col.categories": "Categories",
  "csv.col.notes": "Notes",
  "csv.col.steps": "Steps",
  "csv.col.stepProgress": "Step progress",
  "csv.col.links": "Links",
  "csv.col.hasAttachments": "Has attachments",
  "csv.col.taskId": "Task ID",
  "csv.col.listId": "List ID",

  "status.notStarted": "Not started",
  "status.inProgress": "In progress",
  "status.completed": "Completed",
  "status.waitingOnOthers": "Waiting on others",
  "status.deferred": "Deferred",

  "importance.low": "Low",
  "importance.normal": "Normal",
  "importance.high": "High",

  "common.yes": "Yes",
  "common.no": "No",

  "markdown.plain.due": " (due {date})",
  "markdown.plain.start": " (starts {date})",
  "markdown.plain.completed": " (done {date})",
  "markdown.plain.recurrence": " (repeats: {rule})",
  "markdown.plain.high": " (important)",
  "markdown.plain.low": " (low priority)",

  "things.batch": "{name} ({index}/{total})",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export default en satisfies Messages;
