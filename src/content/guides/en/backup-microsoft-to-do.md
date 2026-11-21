---
title: How to back up Microsoft To Do before the apps retire
description: Export a complete local JSON backup of your Microsoft To Do lists, tasks, steps, notes, reminders, and attachments before June 30, 2027.
answer: Sign in with your Microsoft account in To Do Mover, pick the time zone you normally use Microsoft To Do in, and export the lossless JSON backup (todo-backup.json). Everything runs locally in your browser and can be converted to other formats offline later.
updated: 2026-11-20
target: backup
steps:
  - name: Open the export tool and sign in
    text: Open To Do Mover's export tool and sign in with your Microsoft account using read-only permissions (Tasks.Read and User.Read).
  - name: Check your lists and export time zone
    text: Select the lists you want to keep, choose whether to include completed tasks, and confirm the time zone you normally used Microsoft To Do in so due dates do not shift by a day.
  - name: Download the lossless JSON backup
    text: Keep “JSON backup” selected (optionally enable attachments) and export. Store todo-backup.json in a safe place such as local storage or cloud drive.
  - name: Revoke access when finished
    text: Remove the app's permission in your Microsoft account settings once your backup is saved.
faq:
  - q: Can I still convert todo-backup.json after June 30, 2027?
    a: |
      Yes. Open To Do Mover, choose “JSON backup”, and load your saved todo-backup.json file. No Microsoft sign-in is required, so offline re-exporting works even after Microsoft To Do is shut down.
  - q: Why does the export time zone matter for due dates?
    a: |
      Microsoft Graph stores To Do due dates as midnight in the user's local time zone converted to UTC. Selecting the time zone you normally used Microsoft To Do in converts those timestamps back to the exact calendar day you saw in the app.
sources:
  - title: "Microsoft Support: Moving from Microsoft To Do to Microsoft Planner"
    url: https://support.microsoft.com/en-us/planner/to-do-to-planner
  - title: "Microsoft Graph: To Do API overview"
    url: https://learn.microsoft.com/en-us/graph/api/resources/todo-overview?view=graph-rest-1.0
order: 10
draft: false
---

## Why back up early

Microsoft has announced that **Microsoft To Do apps will retire on June 30, 2027** across Windows, Mac, iOS, Android, and the web, affecting both personal accounts and work or school accounts. While Microsoft notes that the underlying service and APIs will retire on separate, later dates, existing lists do not automatically move to Microsoft Planner—and Planner is not available for personal Microsoft accounts.

Taking a complete backup now gives you a permanent, portable copy of your tasks before any migration deadline or API change.

## What is saved in the JSON backup

The `todo-backup.json` file stores both the cleaned raw responses from Microsoft Graph (with account email metadata stripped) and normalized task fields:

- All selected lists, including shared lists and Outlook flagged-email lists
- Task titles, statuses, importance levels, notes, and categories
- Sub-task checklist steps and completion states
- Due dates, start dates, reminders, and recurrence rules
- Linked resources and attachment metadata (plus downloaded attachment files when enabled)

Two items are not exposed by the Microsoft Graph API and therefore cannot be exported: **My Day** (a temporary daily view) and **list groups** (folders). All lists are exported flat.

## Converting your backup later

You do not need to decide on your next task manager today. Keep `todo-backup.json` safely archived; whenever you are ready to try Todoist, Obsidian, Things 3, Thunderbird, Nextcloud Tasks, or a spreadsheet, reopen the file in To Do Mover offline and export any format you need.
