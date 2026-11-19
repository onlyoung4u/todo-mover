import type { Messages } from "./en";

const zhCN: Messages = {
  "site.name": "To Do 搬家",
  "site.title": "Microsoft To Do 导出 / 迁移工具 — 停服前备份你的任务",
  "site.description":
    "把 Microsoft To Do 的全部清单和任务导出为 JSON、CSV、Markdown、ICS、Todoist 或 Things 格式。完全在浏览器本地运行，数据不经过任何服务器。",

  "landing.news": "Microsoft To Do 将于 2027 年 6 月 30 日停止服务，现有任务不会自动迁移。",
  "landing.countdown": "还剩 {days} 天",
  "landing.headline": "把你的 Microsoft To Do 数据带走",
  "landing.privacy": "数据只在你的浏览器里处理，只发往 graph.microsoft.com，不经过任何其他服务器。",
  "landing.signIn": "用微软账号登录",
  "landing.demo": "先看演示",
  "landing.importJson": "导入之前导出的 JSON",
  "landing.noClientId": "未配置 Client ID，仅可使用演示模式。",

  "app.title": "导出你的任务",
  "app.loading": "加载中…",
  "app.placeholder": "导出工具正在建设中。",

  "footer.disclaimer":
    "本工具为第三方开源项目，与 Microsoft 无关。Microsoft To Do 是 Microsoft 的商标。",
  "footer.source": "源代码",
  "footer.donate": "请我喝杯咖啡",
  "footer.language": "语言",

  "root.choose": "选择语言",

  "notFound.title": "页面不存在",
  "notFound.back": "返回首页",

  "auth.redirecting": "正在完成登录…",

  "export.json.label": "JSON 完整备份",
  "export.json.targets":
    "无损备份。以后可以在本站重新打开并转换为任何格式，即使 Microsoft To Do 已经停服。",
  "export.json.losses": "不丢失信息。附件另存为单独的文件。",
  "export.csv.label": "CSV 表格",
  "export.csv.targets": "Excel、Numbers、Google 表格、Notion",
  "export.csv.losses": "备注格式。步骤、关联链接和重复规则变为纯文本；不包含附件。",
  "export.markdown.label": "Markdown",
  "export.markdown.targets": "Obsidian（Tasks 插件）、Logseq、Notion 及任意笔记应用",
  "export.markdown.losses": "提醒时间、步骤完成时间、附件",

  "export.ics.label": "ICS 日历任务",
  "export.ics.targets": "Thunderbird、Nextcloud Tasks 及其他 CalDAV 任务应用",
  "export.ics.losses": "备注格式；步骤和关联链接写进描述。不包含附件。",
  "export.todoist.label": "Todoist CSV",
  "export.todoist.targets": "Todoist（每个清单导入为一个项目）",
  "export.todoist.losses":
    "已完成任务和已勾选步骤（默认跳过）、开始日期、提醒、附件。重要性只区分 p1 和 p4。",
  "export.things.label": "Things 3",
  "export.things.targets": "Mac、iPhone、iPad 上的 Things 3",
  "export.things.losses":
    "重复规则、提醒和开始日期写进备注。Things 里不存在的标签会被丢弃。不包含附件。",

  "csv.col.list": "清单",
  "csv.col.title": "标题",
  "csv.col.status": "状态",
  "csv.col.importance": "重要",
  "csv.col.due": "截止日期",
  "csv.col.start": "开始日期",
  "csv.col.reminder": "提醒时间",
  "csv.col.recurrence": "重复",
  "csv.col.completed": "完成日期",
  "csv.col.created": "创建时间",
  "csv.col.modified": "修改时间",
  "csv.col.categories": "分类",
  "csv.col.notes": "备注",
  "csv.col.steps": "步骤",
  "csv.col.stepProgress": "步骤进度",
  "csv.col.links": "关联链接",
  "csv.col.hasAttachments": "有附件",
  "csv.col.taskId": "任务ID",
  "csv.col.listId": "清单ID",

  "status.notStarted": "未开始",
  "status.inProgress": "进行中",
  "status.completed": "已完成",
  "status.waitingOnOthers": "等待他人",
  "status.deferred": "已推迟",

  "importance.low": "低",
  "importance.normal": "普通",
  "importance.high": "高",

  "common.yes": "是",
  "common.no": "否",

  "markdown.plain.due": "（截止 {date}）",
  "markdown.plain.start": "（开始 {date}）",
  "markdown.plain.completed": "（完成 {date}）",
  "markdown.plain.recurrence": "（重复：{rule}）",
  "markdown.plain.high": "（重要）",
  "markdown.plain.low": "（低优先级）",

  "things.batch": "{name}（{index}/{total}）",
};

export default zhCN;
