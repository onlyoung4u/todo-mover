import type { LegalDocs } from "./types";

const MS_PRIVACY = "https://privacy.microsoft.com/privacystatement";
const CF_PRIVACY = "https://www.cloudflare.com/privacypolicy/";
const MS_CONSENT_PERSONAL = "https://account.live.com/consent/Manage";
const MS_CONSENT_WORK = "https://myapps.microsoft.com";

/**
 * 隐私声明正文（三语结构必须一致，见 legal.test.ts）。
 * 只描述本站代码的实际行为；改动登录、存储、统计或第三方服务时同步修改这里与 LEGAL_UPDATED。
 */
export const PRIVACY: LegalDocs = {
  en: {
    title: "Privacy policy",
    description:
      "How To Do Mover handles your data: no backend, tasks processed only in your browser, and nothing stored on our side.",
    lead: "To Do Mover has no backend. Your tasks are read and converted in your own browser, and they are never sent to us. This policy explains exactly what the site touches.",
    sections: [
      {
        heading: "What the tool reads",
        blocks: [
          {
            p: "When you sign in, the tool uses the Microsoft identity platform and asks for these delegated Microsoft Graph permissions:",
          },
          {
            list: [
              "User.Read: your name and account address, shown so you can confirm which account is signed in.",
              "Tasks.Read: your To Do lists and tasks, including steps, notes, dates, reminders, recurrence, categories and linked items.",
              "Tasks.ReadWrite: requested only if you choose to read or download attachments, because Microsoft does not return attachments with read-only access. The tool never creates, changes or deletes anything in your account.",
            ],
          },
          {
            p: "If you use demo mode or open a JSON backup instead, no Microsoft sign-in happens and the file is read locally.",
          },
        ],
      },
      {
        heading: "Where your data goes",
        blocks: [
          {
            list: [
              "Your browser talks directly to Microsoft's sign-in servers (login.microsoftonline.com, login.live.com) and to Microsoft Graph (graph.microsoft.com).",
              "Tasks are kept only in the page's memory while you use it. Export files are generated in your browser and saved to your device.",
              "We do not run a server that receives your tasks, files, account address or sign-in tokens, so we have nothing to store, sell or share.",
            ],
          },
        ],
      },
      {
        heading: "What is stored in your browser",
        blocks: [
          {
            list: [
              "Sign-in tokens are kept in session storage and cleared when you close the tab. Signing out clears them right away.",
              "Local storage holds only your theme and language choice.",
              "Task data is never written to local storage, IndexedDB or cookies. This site sets no cookies.",
            ],
          },
        ],
      },
      {
        heading: "Hosting",
        blocks: [
          {
            p: "The site is static and served by Cloudflare. Like any web host, Cloudflare processes technical data such as your IP address and browser details to deliver and protect the pages. We can see only aggregated traffic figures, never the content of your tasks.",
          },
          { links: [{ label: "Cloudflare privacy policy", href: CF_PRIVACY }] },
        ],
      },
      {
        heading: "Analytics",
        when: "analytics",
        blocks: [
          {
            p: "To count visits, the site uses Cloudflare Web Analytics. It sets no cookies, cannot see your tasks or anything you type, and records only anonymous page views.",
          },
        ],
      },
      {
        heading: "Microsoft and other services",
        blocks: [
          {
            p: "Your Microsoft account and the data in it are governed by Microsoft's privacy statement. Links to GitHub, tipping platforms or the apps you import into lead to services with their own policies.",
          },
          { links: [{ label: "Microsoft privacy statement", href: MS_PRIVACY }] },
        ],
      },
      {
        heading: "Revoking access",
        blocks: [
          {
            p: "You can remove the tool's permission to your Microsoft account at any time:",
          },
          {
            links: [
              {
                label: "Personal accounts: account.live.com/consent/Manage",
                href: MS_CONSENT_PERSONAL,
              },
              { label: "Work or school accounts: myapps.microsoft.com", href: MS_CONSENT_WORK },
            ],
          },
        ],
      },
      {
        heading: "Your rights",
        blocks: [
          {
            p: "Because we do not collect or keep personal data about you, there is nothing for us to export, correct or delete. If you think something here is wrong, contact us below.",
          },
        ],
      },
      {
        heading: "Changes",
        blocks: [
          {
            p: "If the way the site handles data changes, we will update this page and its date. The full history of the code is public on GitHub.",
          },
        ],
      },
      {
        heading: "Contact",
        contact: true,
        blocks: [{ p: "Questions about privacy:" }],
      },
    ],
  },
  "zh-CN": {
    title: "隐私政策",
    description:
      "To Do 搬家如何处理你的数据：没有后端，任务只在你的浏览器中处理，我们这边不保存任何内容。",
    lead: "To Do 搬家没有后端。你的任务在你自己的浏览器里读取和转换，不会发给我们。这份政策逐项说明本站会接触到哪些数据。",
    sections: [
      {
        heading: "工具会读取什么",
        blocks: [
          {
            p: "登录时，工具通过 Microsoft 身份平台申请以下 Microsoft Graph 委托权限：",
          },
          {
            list: [
              "User.Read：你的姓名和账号地址，用来显示当前登录的是哪个账号。",
              "Tasks.Read：你的 To Do 清单和任务，包括步骤、备注、日期、提醒、重复规则、分类和关联内容。",
              "Tasks.ReadWrite：只在你选择读取或下载附件时申请，因为微软在只读权限下不返回附件。工具不会在你的账号里新建、修改或删除任何内容。",
            ],
          },
          {
            p: "如果你使用演示模式或打开 JSON 备份，则不会登录微软账号，文件只在本地读取。",
          },
        ],
      },
      {
        heading: "数据会发往哪里",
        blocks: [
          {
            list: [
              "你的浏览器直接连接微软的登录服务器（login.microsoftonline.com、login.live.com）和 Microsoft Graph（graph.microsoft.com）。",
              "任务只在你使用页面期间保存在内存中。导出文件在浏览器中生成，并保存到你的设备上。",
              "我们没有接收你的任务、文件、账号地址或登录令牌的服务器，因此没有任何数据可以保存、出售或分享。",
            ],
          },
        ],
      },
      {
        heading: "浏览器中保存了什么",
        blocks: [
          {
            list: [
              "登录令牌保存在会话存储中，关闭标签页即清除；退出登录会立即清除。",
              "本地存储只保存你选择的主题和语言。",
              "任务数据从不写入本地存储、IndexedDB 或 Cookie。本站不设置任何 Cookie。",
            ],
          },
        ],
      },
      {
        heading: "网站托管",
        blocks: [
          {
            p: "本站是静态网站，由 Cloudflare 托管。和所有网站托管服务一样，Cloudflare 会处理你的 IP 地址、浏览器信息等技术数据，用于传送和保护页面。我们只能看到汇总后的访问量，看不到你的任务内容。",
          },
          { links: [{ label: "Cloudflare 隐私政策", href: CF_PRIVACY }] },
        ],
      },
      {
        heading: "访问统计",
        when: "analytics",
        blocks: [
          {
            p: "为了统计访问量，本站使用 Cloudflare Web Analytics。它不使用 Cookie，也看不到你的任务和你输入的任何内容，只记录匿名的页面访问。",
          },
        ],
      },
      {
        heading: "微软及其他服务",
        blocks: [
          {
            p: "你的微软账号及其中的数据受微软隐私声明约束。指向 GitHub、打赏平台或你要导入的应用的链接，会进入这些服务自己的隐私政策范围。",
          },
          { links: [{ label: "Microsoft 隐私声明", href: MS_PRIVACY }] },
        ],
      },
      {
        heading: "撤销授权",
        blocks: [
          { p: "你可以随时撤销本工具对微软账号的访问权限：" },
          {
            links: [
              { label: "个人账号：account.live.com/consent/Manage", href: MS_CONSENT_PERSONAL },
              { label: "工作或学校账号：myapps.microsoft.com", href: MS_CONSENT_WORK },
            ],
          },
        ],
      },
      {
        heading: "你的权利",
        blocks: [
          {
            p: "我们不收集也不保留你的个人数据，因此没有可供导出、更正或删除的内容。如果你认为这里的说明有误，请通过下方方式联系我们。",
          },
        ],
      },
      {
        heading: "政策变更",
        blocks: [
          {
            p: "如果本站处理数据的方式发生变化，我们会更新本页和更新日期。代码的完整修改历史公开在 GitHub 上。",
          },
        ],
      },
      {
        heading: "联系我们",
        contact: true,
        blocks: [{ p: "有关隐私的问题：" }],
      },
    ],
  },
  "zh-TW": {
    title: "隱私權政策",
    description:
      "To Do 搬家如何處理你的資料：沒有後端，任務只在你的瀏覽器中處理，我們這邊不保存任何內容。",
    lead: "To Do 搬家沒有後端。你的任務在你自己的瀏覽器裡讀取和轉換，不會傳給我們。這份政策逐項說明本站會接觸到哪些資料。",
    sections: [
      {
        heading: "工具會讀取什麼",
        blocks: [
          {
            p: "登入時，工具透過 Microsoft 身分識別平台申請以下 Microsoft Graph 委派權限：",
          },
          {
            list: [
              "User.Read：你的姓名和帳號地址，用來顯示目前登入的是哪個帳號。",
              "Tasks.Read：你的 To Do 清單和任務，包括步驟、備註、日期、提醒、重複規則、類別和關聯內容。",
              "Tasks.ReadWrite：只在你選擇讀取或下載附件時申請，因為微軟在唯讀權限下不回傳附件。工具不會在你的帳號裡新增、修改或刪除任何內容。",
            ],
          },
          {
            p: "如果你使用示範模式或開啟 JSON 備份，則不會登入微軟帳號，檔案只在本機讀取。",
          },
        ],
      },
      {
        heading: "資料會傳到哪裡",
        blocks: [
          {
            list: [
              "你的瀏覽器直接連線到微軟的登入伺服器（login.microsoftonline.com、login.live.com）和 Microsoft Graph（graph.microsoft.com）。",
              "任務只在你使用頁面期間保存在記憶體中。匯出檔案在瀏覽器中產生，並儲存到你的裝置上。",
              "我們沒有接收你的任務、檔案、帳號地址或登入權杖的伺服器，因此沒有任何資料可以保存、出售或分享。",
            ],
          },
        ],
      },
      {
        heading: "瀏覽器中保存了什麼",
        blocks: [
          {
            list: [
              "登入權杖保存在工作階段儲存空間中，關閉分頁即清除；登出會立即清除。",
              "本機儲存空間只保存你選擇的主題和語言。",
              "任務資料從不寫入本機儲存空間、IndexedDB 或 Cookie。本站不設定任何 Cookie。",
            ],
          },
        ],
      },
      {
        heading: "網站託管",
        blocks: [
          {
            p: "本站是靜態網站，由 Cloudflare 託管。和所有網站託管服務一樣，Cloudflare 會處理你的 IP 位址、瀏覽器資訊等技術資料，用於傳送和保護頁面。我們只能看到彙總後的造訪量，看不到你的任務內容。",
          },
          { links: [{ label: "Cloudflare 隱私權政策", href: CF_PRIVACY }] },
        ],
      },
      {
        heading: "造訪統計",
        when: "analytics",
        blocks: [
          {
            p: "為了統計造訪量，本站使用 Cloudflare Web Analytics。它不使用 Cookie，也看不到你的任務和你輸入的任何內容，只記錄匿名的頁面造訪。",
          },
        ],
      },
      {
        heading: "微軟及其他服務",
        blocks: [
          {
            p: "你的微軟帳號及其中的資料受微軟隱私權聲明約束。指向 GitHub、贊助平台或你要匯入的應用程式的連結，會進入這些服務自己的隱私權政策範圍。",
          },
          { links: [{ label: "Microsoft 隱私權聲明", href: MS_PRIVACY }] },
        ],
      },
      {
        heading: "撤銷授權",
        blocks: [
          { p: "你可以隨時撤銷本工具對微軟帳號的存取權限：" },
          {
            links: [
              { label: "個人帳號：account.live.com/consent/Manage", href: MS_CONSENT_PERSONAL },
              { label: "公司或學校帳號：myapps.microsoft.com", href: MS_CONSENT_WORK },
            ],
          },
        ],
      },
      {
        heading: "你的權利",
        blocks: [
          {
            p: "我們不蒐集也不保留你的個人資料，因此沒有可供匯出、更正或刪除的內容。如果你認為這裡的說明有誤，請透過下方方式聯絡我們。",
          },
        ],
      },
      {
        heading: "政策變更",
        blocks: [
          {
            p: "如果本站處理資料的方式有所變更，我們會更新本頁和更新日期。程式碼的完整修改紀錄公開在 GitHub 上。",
          },
        ],
      },
      {
        heading: "聯絡我們",
        contact: true,
        blocks: [{ p: "有關隱私權的問題：" }],
      },
    ],
  },
};
