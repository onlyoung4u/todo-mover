import type { Messages } from "./en";

const zhTW: Messages = {
  "site.name": "To Do 搬家",
  "site.title": "Microsoft To Do 匯出 / 遷移工具 — 停止服務前備份你的工作",
  "site.description":
    "將 Microsoft To Do 的所有清單與工作匯出為 JSON、CSV、Markdown、ICS、Todoist 或 Things 格式。完全在瀏覽器本機執行，資料不經過任何伺服器。",

  "landing.news": "Microsoft To Do 將於 2027 年 6 月 30 日停止服務，現有工作不會自動遷移。",
  "landing.countdown": "還剩 {days} 天",
  "landing.headline": "把你的 Microsoft To Do 資料帶走",
  "landing.privacy":
    "資料只在你的瀏覽器中處理，只傳送到 graph.microsoft.com，不經過任何其他伺服器。",
  "landing.signIn": "使用 Microsoft 帳戶登入",
  "landing.demo": "先看示範",
  "landing.importJson": "匯入先前匯出的 JSON",
  "landing.noClientId": "未設定 Client ID，僅能使用示範模式。",

  "app.title": "匯出你的工作",
  "app.loading": "載入中…",
  "app.placeholder": "匯出工具正在建置中。",

  "footer.disclaimer":
    "本工具為第三方開源專案，與 Microsoft 無關。Microsoft To Do 是 Microsoft 的商標。",
  "footer.source": "原始碼",
  "footer.donate": "請我喝杯咖啡",
  "footer.language": "語言",

  "root.choose": "選擇語言",

  "notFound.title": "找不到頁面",
  "notFound.back": "返回首頁",

  "auth.redirecting": "正在完成登入…",

  "export.json.label": "JSON 完整備份",
  "export.json.targets":
    "無損備份。之後可以在本站重新開啟並轉換為任何格式，即使 Microsoft To Do 已停止服務。",
  "export.json.losses": "不遺失資訊。附件另存為獨立檔案。",
  "export.csv.label": "CSV 表格",
  "export.csv.targets": "Excel、Numbers、Google 試算表、Notion",
  "export.csv.losses": "備註格式。步驟、連結與重複規則變為純文字；不包含附件。",
  "export.markdown.label": "Markdown",
  "export.markdown.targets": "Obsidian（Tasks 外掛程式）、Logseq、Notion 及任何筆記應用程式",
  "export.markdown.losses": "提醒時間、步驟完成時間、附件",

  "export.ics.label": "ICS 行事曆工作",
  "export.ics.targets": "Thunderbird、Nextcloud Tasks 及其他 CalDAV 工作應用程式",
  "export.ics.losses": "備註格式；步驟與連結寫進描述。不包含附件。",
  "export.todoist.label": "Todoist CSV",
  "export.todoist.targets": "Todoist（每個清單匯入為一個專案）",
  "export.todoist.losses":
    "已完成工作與已勾選步驟（預設略過）、開始日期、提醒、附件。重要性只區分 p1 與 p4。",
  "export.things.label": "Things 3",
  "export.things.targets": "Mac、iPhone、iPad 上的 Things 3",
  "export.things.losses":
    "重複規則、提醒與開始日期寫進備註。Things 中不存在的標籤會被捨棄。不包含附件。",

  "csv.col.list": "清單",
  "csv.col.title": "標題",
  "csv.col.status": "狀態",
  "csv.col.importance": "重要性",
  "csv.col.due": "到期日",
  "csv.col.start": "開始日期",
  "csv.col.reminder": "提醒時間",
  "csv.col.recurrence": "重複",
  "csv.col.completed": "完成日期",
  "csv.col.created": "建立時間",
  "csv.col.modified": "修改時間",
  "csv.col.categories": "類別",
  "csv.col.notes": "備註",
  "csv.col.steps": "步驟",
  "csv.col.stepProgress": "步驟進度",
  "csv.col.links": "連結",
  "csv.col.hasAttachments": "有附件",
  "csv.col.taskId": "工作ID",
  "csv.col.listId": "清單ID",

  "status.notStarted": "未開始",
  "status.inProgress": "進行中",
  "status.completed": "已完成",
  "status.waitingOnOthers": "等待他人",
  "status.deferred": "已延後",

  "importance.low": "低",
  "importance.normal": "一般",
  "importance.high": "高",

  "common.yes": "是",
  "common.no": "否",

  "markdown.plain.due": "（到期 {date}）",
  "markdown.plain.start": "（開始 {date}）",
  "markdown.plain.completed": "（完成 {date}）",
  "markdown.plain.recurrence": "（重複：{rule}）",
  "markdown.plain.high": "（重要）",
  "markdown.plain.low": "（低優先順序）",

  "things.batch": "{name}（{index}/{total}）",
};

export default zhTW;
