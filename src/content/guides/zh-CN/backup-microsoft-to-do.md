---
title: 在应用退役前备份 Microsoft To Do
description: 在 2027 年 6 月 30 日 Microsoft To Do 应用退役前，在浏览器本地导出完整的无损 JSON 备份，包含清单、任务、步骤、备注、提醒与附件。
answer: 在 To Do 搬家中用微软账号登录，确认平时使用 To Do 的时区，导出无损的 JSON 备份（todo-backup.json）。全部处理都在浏览器本地完成，日后无需登录也能离线转换为其他应用格式。
updated: 2026-11-20
target: backup
steps:
  - name: 打开导出工具并登录
    text: 进入 To Do 搬家导出工具，使用微软账号以只读权限（Tasks.Read 与 User.Read）登录。
  - name: 核对清单与导出时区
    text: 勾选需要保存的清单，决定是否包含已完成任务，并确认你平时使用 Microsoft To Do 时所在的时区，避免截止日期差一天。
  - name: 下载无损 JSON 备份
    text: 保持勾选“JSON 完整备份”（按需开启下载附件）并点击导出，把生成的 todo-backup.json 妥善保存到本地或网盘。
  - name: 完成后撤销授权
    text: 确认备份文件完整保存后，前往微软账号授权管理页面撤销本站权限。
faq:
  - q: 2027 年 6 月 30 日之后还能把 todo-backup.json 转成其他格式吗？
    a: |
      可以。打开本站导出工具并选择“JSON 备份”，载入之前保存的 todo-backup.json 即可离线转换为任意格式，全程不需要连接微软服务器。
  - q: 为什么导出时区会影响截止日期？
    a: |
      Microsoft Graph 会把任务截止日期按用户本地零点换算为 UTC 时间存储。选择你平时使用 To Do 时的时区，才能把截止日期还原成你在应用里看到的准确日期。
sources:
  - title: Microsoft 支持：从 Microsoft To Do 迁移到 Microsoft Planner
    url: https://support.microsoft.com/en-us/planner/to-do-to-planner
  - title: Microsoft Graph：To Do API 概览
    url: https://learn.microsoft.com/en-us/graph/api/resources/todo-overview?view=graph-rest-1.0
order: 10
draft: false
---

## 为什么要尽早备份

微软已宣布 **Microsoft To Do 全平台应用将于 2027 年 6 月 30 日退役**（覆盖 Windows、Mac、iOS、Android 和网页版），个人账号与工作/学校账号均在影响范围内。底层服务和 API 将在之后另行公布的日期关停。现有任务不会自动迁移到 Microsoft Planner，而且个人微软账号无法使用 Planner。

尽早做一份本地完整备份，可以让你从容挑选下一款任务工具，不必担心临近停服或接口变动。

## JSON 备份里保存了什么

`todo-backup.json` 同时保存了脱敏后的微软 Graph 原始响应和归一化后的结构化字段：

- 所选的全部清单（含共享清单与 Outlook 标记邮件清单）
- 任务标题、状态、重要程度、备注与分类
- 子任务步骤及勾选状态
- 截止日期、开始日期、提醒时间与重复规则
- 关联链接与附件元数据（勾选“下载附件”时一并打包附件文件）

受限于 Microsoft Graph 接口能力，**“我的一天”**（临时视图）与**清单分组**无法通过接口读取，所有清单会平铺导出。

## 以后再转换格式

你不需要今天就决定迁移到哪款应用。先把 `todo-backup.json` 保存好；以后想试用 Todoist、Obsidian、Things 3、Thunderbird、Nextcloud Tasks 或表格工具时，直接在本站离线载入这份备份即可导出对应文件。
