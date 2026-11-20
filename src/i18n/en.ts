/** 英文文案是所有 key 的来源；其他语言必须提供完全相同的 key（类型检查和单元测试会核对）。 */
const en = {
  "site.name": "To Do Mover",
  "site.title": "Export Microsoft To Do — backup & migrate before it shuts down",
  "site.description":
    "Export all your Microsoft To Do lists and tasks to JSON, CSV, Markdown, ICS, Todoist or Things. Runs entirely in your browser; your data never touches our servers.",

  "landing.signIn": "Sign in with Microsoft",
  "landing.demo": "Try the demo",
  "landing.noClientId": "Client ID not configured — demo mode only.",

  "app.title": "Export your tasks",
  "app.loading": "Loading…",

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

  "landing.how.heading": "How it works",
  "landing.how.step1":
    "Sign in with your Microsoft account, or open a JSON backup you exported earlier.",
  "landing.how.step2":
    "Preview your lists, choose which ones to export and the time zone you used To Do in.",
  "landing.how.step3": "Pick one or more formats and download the files.",
  "landing.formats.heading": "Export formats",
  "landing.privacyDetails.heading": "Privacy",
  "landing.privacyDetails.body":
    "This site has no backend. Your tasks are read in your browser, kept only in memory, and sent nowhere except Microsoft's own servers. Sign-in tokens live in session storage and are cleared when you close the tab. The source code is public.",
  "app.start.heading": "Where should your tasks come from?",
  "app.start.signIn": "Microsoft account",
  "app.start.signInDesc": "Read all your lists directly from Microsoft To Do.",
  "app.start.signInSoon": "Sign-in is coming soon. For now, try the demo or open a JSON backup.",
  "app.start.demo": "Demo",
  "app.start.demoDesc": "Sample lists and tasks. No sign-in needed.",
  "app.start.import": "JSON backup",
  "app.start.importDesc":
    "A todo-backup.json exported from this site. Works without signing in, even after Microsoft To Do shuts down.",
  "app.start.chooseFile": "Choose file…",
  "app.import.error.invalidJson": "This file isn't valid JSON.",
  "app.import.error.notBackup": "This file isn't a backup exported by this site.",
  "app.import.error.noRawData":
    "This backup doesn't contain the original data, so it can't be converted again.",
  "app.import.error.newerSchema":
    "This backup was made by a newer version of this site. Reload the page and try again.",
  "app.source.demo": "Demo data",
  "app.source.import": "From backup: {file}",
  "app.back": "Start over",
  "app.lists.heading": "Lists",
  "app.lists.selectAll": "All",
  "app.lists.selectNone": "None",
  "app.lists.count": "Tasks: {tasks} · Done: {completed}",
  "app.lists.flagged": "Flagged email",
  "app.lists.shared": "Shared",
  "app.lists.empty": "No tasks",
  "app.preview.noList": "Select a list to preview its tasks.",
  "app.preview.steps": "Steps {done}/{total}",
  "app.preview.due": "Due {date}",
  "app.preview.reminder": "Reminder {time}",
  "app.preview.attachments": "Attachments: {count}",
  "app.preview.links": "Links: {count}",
  "app.preview.important": "Important",
  "app.options.heading": "Options",
  "app.options.includeCompleted": "Include completed tasks",
  "app.options.timeZone": "Export time zone",
  "app.options.timeZoneHelp":
    "Choose the time zone you usually used Microsoft To Do in. Due dates are calculated in this time zone, so a wrong choice can shift them by a day.",
  "app.options.attachments": "Download attachments",
  "app.options.attachmentsUnavailable": "Only available after signing in with Microsoft.",
  "app.limits.heading": "Not available from Microsoft:",
  "app.limits.text": "My Day (a temporary view) and list groups. All lists are exported flat.",
  "app.formats.heading": "Formats",
  "app.formats.ticktick":
    "Moving to TickTick or 滴答清单? Their built-in “Import from Microsoft To Do” is the easiest route. Keep the JSON backup from here as a safety net.",
  "app.formats.ticktickLink": "Official help",
  "app.formats.recommended": "Recommended",
  "app.formats.targets": "Works with",
  "app.formats.losses": "What gets lost",
  "app.formats.appleOnly": "Only for macOS and iOS.",
  "opt.csv.formulaGuard":
    "Protect against Excel formulas (adds ' before cells starting with = + - @)",
  "opt.markdown.style": "Style",
  "opt.markdown.styleObsidian": "Obsidian Tasks (emoji markers)",
  "opt.markdown.stylePlain": "Plain text",
  "opt.markdown.singleFile": "Combine into a single todo.md",
  "opt.todoist.includeCompleted": "Include completed tasks (imported as open)",
  "opt.todoist.includeCheckedSteps": "Include checked steps",
  "opt.todoist.categoriesAsLabels": "Turn categories into Todoist labels",
  "app.export.button": "Export",
  "app.export.working": "Preparing files…",
  "app.export.noList": "Choose at least one list.",
  "app.export.noFormat": "Choose at least one format.",
  "app.export.summary": "Lists: {lists} · Tasks: {tasks} · Formats: {formats}",
  "app.export.failed": "Something went wrong while creating the files. Please try again.",
  "app.done.heading": "Your export is ready",
  "app.done.downloaded": "Downloaded {file}.",
  "app.done.downloadAgain": "Download again",
  "app.done.backToPreview": "Back to options",
  "app.done.things.heading": "Open in Things",
  "app.done.things.hint": "Click the buttons one at a time and wait a few seconds between clicks.",
  "app.done.things.open": "Open in Things",
  "app.done.warnings": "Notes from the export ({count})",
  "app.done.guides": "How to import",
  "app.done.officialHelp": "Official help",
  "app.done.revoke.heading": "Remove this site's access",
  "app.done.revoke.personal": "Personal Microsoft account:",
  "app.done.revoke.work": "Work or school account:",
  "app.done.donate": "If this saved you some time, you can buy me a coffee.",
  "app.done.follow": "Follow the project for future tools:",
  "guide.json.title": "Keep the JSON backup",
  "guide.json.steps":
    "Save todo-backup.json somewhere safe, such as your cloud drive.\nTo convert it later, open this site and choose “JSON backup”.\nNo sign-in is needed, so this works even after Microsoft To Do shuts down.",
  "guide.excel.title": "Excel, Numbers, Google Sheets",
  "guide.excel.steps":
    "Open todo-tasks.csv directly. The file is UTF-8 with a BOM, so non-English text displays correctly.\nIf characters still look garbled in an older Excel, use Data → From Text/CSV and choose UTF-8.\nIn Google Sheets, use File → Import → Upload.",
  "guide.obsidian.title": "Obsidian and other notes apps",
  "guide.obsidian.steps":
    "Copy the .md files into your vault.\nFor due dates, priorities and recurrence, install the community plugin “Tasks”.\nThe plain-text style works in any notes app, such as Logseq or Notion (Import → Markdown).",
  "guide.thunderbird.title": "Thunderbird",
  "guide.thunderbird.steps":
    "Open the Tasks tab.\nChoose Events and Tasks → Import (in newer versions: File → Import → Calendars) and pick an .ics file.\nRepeat for each list.",
  "guide.nextcloud.title": "Nextcloud Tasks",
  "guide.nextcloud.steps":
    "Open the Calendar app and go to Calendar settings → Import calendar.\nChoose an .ics file and the calendar to import into (or a new one).\nThe tasks then appear in the Tasks app.",
  "guide.todoist.title": "Todoist",
  "guide.todoist.steps":
    "Create a project for each list, or open an existing one.\nOpen the project's … menu and choose Import from CSV.\nPick the matching CSV file, then repeat for each list.\nRecurring tasks start from today; the original due date is kept in the description.",
  "guide.things.title": "Things 3",
  "guide.things.steps":
    "Do the export on the Mac, iPhone or iPad where Things is installed; the buttons only work there.\nClick the “Open in Things” buttons one at a time, waiting a few seconds between clicks.\nTags that don't already exist in Things are skipped, so create them first if you need them.",
  "guide.ticktick.title": "TickTick / 滴答清单",
  "guide.ticktick.steps":
    "TickTick can import straight from Microsoft To Do: in the web app, open Settings → Integrations & Import → Microsoft To Do.\nSign in with your Microsoft account and choose the lists to import.\nKeep the JSON backup from this site as a safety net.",

  "app.source.graph": "Microsoft account: {name}",
  "app.signOut": "Sign out",
  "app.listSeparator": ", ",
  "app.lists.failed": "Couldn't read",
  "app.start.signedInAs": "Signed in as {name}",
  "app.start.readTasks": "Read my tasks",
  "app.start.signInRedirect": "Sign in in this tab instead",
  "app.start.grantPermission": "Grant the extra permission",
  "app.start.permissions":
    "Read-only: this site reads your name and your tasks, and never changes anything in your account.",
  "app.read.heading": "Reading your tasks…",
  "app.read.starting": "Connecting to Microsoft…",
  "app.read.progress": "Lists {done}/{total}, tasks {tasks}…",
  "app.read.someFailed":
    "These lists couldn't be read: {names}. Everything else was read; you can retry just these.",
  "app.read.retry": "Retry",
  "app.read.retrying": "Retrying…",
  "app.read.listFailed": "List “{name}” couldn't be read and is not included.",
  "app.error.consentBlocked":
    "Your organization doesn't allow authorizing third-party apps. Please contact your IT administrator, or use a personal account.",
  "app.error.misconfigured":
    "This site's Azure app registration is set up incorrectly: the redirect URI {uri} must be registered under the “Single-page application” platform (not “Web”). See the self-hosting guide in the README. Details: {message}",
  "app.error.popupBlocked":
    "Your browser blocked the sign-in pop-up. Allow pop-ups for this site and try again, or sign in in this tab instead.",
  "app.error.sessionExpired":
    "Your sign-in has expired. Please sign in again; data that was already read is kept.",
  "app.error.forbidden":
    "Microsoft refused to share your tasks with the read-only permission. You can grant the read/write permission instead; this site still only reads and never changes anything.",
  "app.error.network": "Couldn't reach Microsoft. Check your connection and try again.",
  "app.error.other": "Something went wrong: {message}",
  "app.attachments.metadata": "Checking attachments {done}/{total}…",
  "app.attachments.downloading": "Downloading attachments {done}/{total}…",
  "app.attachments.confirm": "The attachments add up to about {size} MB. Download all of them?",
  "app.attachments.skipped":
    "Attachments were not downloaded, as you chose. Their names are still listed in the JSON backup.",
  "app.attachments.failed":
    "Attachment “{name}” of task “{task}” couldn't be downloaded ({reason}).",
  "app.attachments.denied":
    "Microsoft refused to read attachments with the read-only permission. Grant the read/write permission to include them; this site still only reads and never changes anything.",
  "app.attachments.grant": "Grant permission and read attachments",
  "app.attachments.granting": "Reading attachments…",
  "app.attachments.deniedReadWrite":
    "Microsoft still refused to read attachments after the read/write permission was granted. Attachments can't be exported; everything else is unaffected.",
  "app.attachments.metadataFailed": "Couldn't read the attachments of task “{task}” ({reason}).",

  "landing.headline": "Take your Microsoft To Do tasks with you",
  "nav.label": "Main",
  "nav.tool": "Export tool",
  "nav.formats": "Formats",
  "nav.theme": "Switch between light and dark",
  "nav.privacy": "Privacy",
  "footer.local": "Runs entirely in your browser",
  "landing.eyebrow": "Microsoft To Do shuts down on June 30, 2027 · {days} days left",
  "landing.lead":
    "Export every list, task, step, note and reminder as a complete backup, plus files that Excel, Obsidian, Todoist, Things and calendar apps can import. Everything happens in your browser.",
  "landing.local": "Processed locally",
  "landing.windowFoot": "0 bytes uploaded · talks only to graph.microsoft.com",
  "landing.how.eyebrow": "How it works",
  "landing.stepLabel": "Step {n}",
  "landing.formats.eyebrow": "Six formats, one read",
  "landing.privacyDetails.eyebrow": "Your data stays yours",
  "landing.limits.eyebrow": "Good to know",
  "landing.limits.heading": "What Microsoft doesn't provide",
  "app.start.eyebrow": "Step 1 · Choose where your tasks come from",
  "app.start.dropHint": "Or drop the file here.",
  "app.read.eyebrow": "Reading",
  "app.window.stats": "{lists} lists · {tasks} tasks",
  "app.detail.empty": "Select a task to see its details.",
  "app.detail.attachments": "Attachments",
  "app.detail.attachmentsUnknown": "This task has attachments, but their details couldn't be read.",
  "app.export.eyebrow": "Export",
  "app.export.heading": "Choose formats and options",
  "app.done.eyebrow": "Step 3 · Done",
  "app.done.downloadedLabel": "Downloaded",
  "app.done.guidesEyebrow": "Next",
  "app.preview.eyebrow": "Step 2 · Review and export",
  "app.preview.heading": "Review your tasks",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export default en satisfies Messages;
