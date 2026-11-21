---
title: 在應用程式退役前備份 Microsoft To Do
description: 在 2027 年 6 月 30 日 Microsoft To Do 應用程式退役前，於瀏覽器本機匯出完整的無損 JSON 備份，包含清單、工作、步驟、備註、提醒與附件。
answer: 在 To Do 搬家中使用 Microsoft 帳戶登入，確認平常使用 To Do 的時區，匯出無損的 JSON 備份（todo-backup.json）。所有處理都在瀏覽器本機完成，日後無需登入也能離線轉換為其他應用程式格式。
updated: 2026-11-20
target: backup
steps:
  - name: 開啟匯出工具並登入
    text: 進入 To Do 搬家匯出工具，使用 Microsoft 帳戶以唯讀權限（Tasks.Read 與 User.Read）登入。
  - name: 核對清單與匯出時區
    text: 勾選要保存的清單，決定是否包含已完成工作，並確認你平常使用 Microsoft To Do 時所在的時區，避免到期日差一天。
  - name: 下載無損 JSON 備份
    text: 保持勾選「JSON 完整備份」（依需求開啟下載附件）並點選匯出，把產生的 todo-backup.json 妥善保存至本機或雲端硬碟。
  - name: 完成後撤銷授權
    text: 確認備份檔案已妥善保存後，前往 Microsoft 帳戶授權管理頁面撤銷本站權限。
faq:
  - q: 2027 年 6 月 30 日之後還能把 todo-backup.json 轉成其他格式嗎？
    a: |
      可以。開啟本站匯出工具並選擇「JSON 備份」，載入先前保存的 todo-backup.json 即可離線轉換為任意格式，全程不需要連線至 Microsoft 伺服器。
  - q: 為什麼匯出時區會影響到期日？
    a: |
      Microsoft Graph 會將工作到期日依使用者本機午夜換算為 UTC 時間儲存。選擇你平常使用 To Do 時的時區，才能把到期日還原為你在應用程式中看到的正確日期。
sources:
  - title: Microsoft 支援服務：從 Microsoft To Do 移至 Microsoft Planner
    url: https://support.microsoft.com/en-us/planner/to-do-to-planner
  - title: Microsoft Graph：To Do API 概觀
    url: https://learn.microsoft.com/en-us/graph/api/resources/todo-overview?view=graph-rest-1.0
order: 10
draft: false
---

## 為什麼要盡早備份

Microsoft 已宣布 **Microsoft To Do 全平台應用程式將於 2027 年 6 月 30 日退役**（涵蓋 Windows、Mac、iOS、Android 與網頁版），個人帳戶與公司或學校帳戶均受影響；底層服務與 API 會在之後另行公布的日期停止。現有工作不會自動遷移至 Microsoft Planner，且個人 Microsoft 帳戶無法使用 Planner。

盡早保留一份本機完整備份，能讓你從容挑選下一款工作管理工具，不必擔心臨近停服或介面變動。

## JSON 備份裡保存了什麼

`todo-backup.json` 同時保存了去識別化的 Microsoft Graph 原始回應與正規化後的結構化欄位：

- 所選的全部清單（含共用清單與 Outlook 已標幟郵件清單）
- 工作標題、狀態、重要性、備註與類別
- 子工作步驟與勾選狀態
- 到期日、開始日期、提醒時間與重複規則
- 關聯連結與附件中繼資料（勾選「下載附件」時一併打包附件檔案）

受限於 Microsoft Graph 介面能力，**「我的一天」**（暫時檢視）與**清單群組**無法透過介面讀取，所有清單會平鋪匯出。

## 日後再轉換格式

你不需要今天就決定遷移到哪款應用程式。先把 `todo-backup.json` 保存好；日後想嘗試 Todoist、Obsidian、Things 3、Thunderbird、Nextcloud Tasks 或試算表工具時，直接在本站離線載入這份備份即可匯出對應檔案。
