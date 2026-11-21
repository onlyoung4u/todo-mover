import type { LegalDocs } from "./types";

const MS_TERMS = "https://www.microsoft.com/servicesagreement";
const AGPL = "https://www.gnu.org/licenses/agpl-3.0.html";

/** 服务条款正文（三语结构必须一致，见 legal.test.ts）。修改时同步更新 LEGAL_UPDATED。 */
export const TERMS: LegalDocs = {
  en: {
    title: "Terms of service",
    description:
      "The terms for using To Do Mover, a free, open-source, browser-only tool for exporting your Microsoft To Do data.",
    lead: "These terms cover your use of this website. By using it, you agree to them. If you don't agree, please don't use the site.",
    sections: [
      {
        heading: "The service",
        blocks: [
          {
            p: "To Do Mover is a free, open-source tool that runs in your browser and exports your own Microsoft To Do data to backup and import formats. It is a third-party project and is not affiliated with, endorsed by or sponsored by Microsoft. Microsoft To Do is a trademark of Microsoft.",
          },
        ],
      },
      {
        heading: "Your responsibilities",
        blocks: [
          {
            list: [
              "Use the tool only with Microsoft accounts you own or are authorized to access, and follow Microsoft's terms for your account.",
              "Exported files contain your personal information. Keep them somewhere safe, and only import them into services you trust.",
              "Don't use the site to break the law, to attack it or other systems, or to interfere with other people's use of it.",
            ],
          },
          { links: [{ label: "Microsoft Services Agreement", href: MS_TERMS }] },
        ],
      },
      {
        heading: "Backups and accuracy",
        blocks: [
          {
            p: "The tool can only export what Microsoft's API provides, and some things (such as My Day and list groups) are not available. Each target app supports only part of the data, and Microsoft may change or shut down the API without notice. Check your exported files, and keep the JSON backup as your complete copy.",
          },
        ],
      },
      {
        heading: "No warranty",
        blocks: [
          {
            p: 'The site and the tool are provided "as is" and "as available", without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We don\'t guarantee that the site will be available, error-free, or that exports will be complete or import correctly.',
          },
        ],
      },
      {
        heading: "Limitation of liability",
        blocks: [
          {
            p: "To the fullest extent permitted by law, we are not liable for any indirect, incidental, special or consequential damages, or for any loss of data, tasks or profits, arising from your use of or inability to use the site, even if we were told such damages were possible. Some jurisdictions don't allow these limits, so they may not apply to you.",
          },
        ],
      },
      {
        heading: "Open-source license",
        blocks: [
          {
            p: "The source code is licensed under the GNU Affero General Public License v3.0. These terms govern your use of this website; the license governs your use of the code. The To Do Mover and Alchemew names and logos are not covered by the license.",
          },
          { links: [{ label: "GNU AGPL-3.0", href: AGPL }] },
        ],
      },
      {
        heading: "Tips",
        when: "donate",
        blocks: [
          {
            p: "Tips are voluntary gifts that support the project. They don't buy any service, support or feature, and the tool stays free whether or not you tip.",
          },
        ],
      },
      {
        heading: "Changes to the site and these terms",
        blocks: [
          {
            p: "We may change, suspend or discontinue the site at any time. We may also update these terms; the date at the top shows the latest version. If you keep using the site after a change, you accept the updated terms.",
          },
        ],
      },
      {
        heading: "Contact",
        contact: true,
        blocks: [{ p: "Questions about these terms:" }],
      },
    ],
  },
  "zh-CN": {
    title: "服务条款",
    description:
      "To Do 搬家的使用条款。本工具免费、开源，只在浏览器中运行，用于导出你的 Microsoft To Do 数据。",
    lead: "本条款适用于你对本网站的使用。使用本网站即表示你同意本条款；如果不同意，请不要使用本网站。",
    sections: [
      {
        heading: "服务内容",
        blocks: [
          {
            p: "To Do 搬家是一个免费的开源工具，在你的浏览器中运行，把你自己的 Microsoft To Do 数据导出为备份和可导入其他应用的格式。本工具为第三方项目，与 Microsoft 无关，未获得 Microsoft 的认可或赞助。Microsoft To Do 是 Microsoft 的商标。",
          },
        ],
      },
      {
        heading: "你的责任",
        blocks: [
          {
            list: [
              "只对你本人拥有或有权访问的微软账号使用本工具，并遵守微软对该账号的服务条款。",
              "导出的文件包含你的个人信息。请妥善保管，只导入你信任的服务。",
              "不得利用本网站从事违法活动、攻击本网站或其他系统，或妨碍他人正常使用。",
            ],
          },
          { links: [{ label: "Microsoft 服务协议", href: MS_TERMS }] },
        ],
      },
      {
        heading: "备份与准确性",
        blocks: [
          {
            p: "本工具只能导出微软接口提供的内容，部分内容（如“我的一天”和清单分组）无法获取。各目标应用只支持部分数据，微软也可能在不另行通知的情况下修改或关闭接口。请检查导出的文件，并保留 JSON 备份作为完整副本。",
          },
        ],
      },
      {
        heading: "不提供担保",
        blocks: [
          {
            p: "本网站和本工具按“现状”和“现有”提供，不作任何明示或默示的担保，包括但不限于适销性、特定用途适用性和不侵权。我们不保证本网站始终可用、没有错误，也不保证导出结果完整或能被正确导入。",
          },
        ],
      },
      {
        heading: "责任限制",
        blocks: [
          {
            p: "在法律允许的最大范围内，对于因你使用或无法使用本网站而产生的任何间接、附带、特殊或后果性损失，以及任何数据、任务或利润损失，我们不承担责任，即使事先已被告知可能发生此类损失。部分司法辖区不允许此类限制，因此上述限制可能不适用于你。",
          },
        ],
      },
      {
        heading: "开源许可",
        blocks: [
          {
            p: "源代码以 GNU Affero 通用公共许可证第 3 版（AGPL-3.0）授权。本条款约束你对本网站的使用，许可证约束你对代码的使用。To Do 搬家与 Alchemew 的名称和标志不在许可证授权范围内。",
          },
          { links: [{ label: "GNU AGPL-3.0", href: AGPL }] },
        ],
      },
      {
        heading: "打赏",
        when: "donate",
        blocks: [
          {
            p: "打赏是对项目的自愿支持，不购买任何服务、技术支持或功能。无论是否打赏，本工具都保持免费。",
          },
        ],
      },
      {
        heading: "网站与条款的变更",
        blocks: [
          {
            p: "我们可能随时修改、暂停或停止本网站，也可能更新本条款，页面顶部的日期即最新版本。变更后继续使用本网站，即表示你接受更新后的条款。",
          },
        ],
      },
      {
        heading: "联系我们",
        contact: true,
        blocks: [{ p: "有关本条款的问题：" }],
      },
    ],
  },
  "zh-TW": {
    title: "服務條款",
    description:
      "To Do 搬家的使用條款。本工具免費、開源，只在瀏覽器中執行，用於匯出你的 Microsoft To Do 資料。",
    lead: "本條款適用於你對本網站的使用。使用本網站即表示你同意本條款；如果不同意，請不要使用本網站。",
    sections: [
      {
        heading: "服務內容",
        blocks: [
          {
            p: "To Do 搬家是一個免費的開源工具，在你的瀏覽器中執行，把你自己的 Microsoft To Do 資料匯出為備份和可匯入其他應用程式的格式。本工具為第三方專案，與 Microsoft 無關，未獲得 Microsoft 的認可或贊助。Microsoft To Do 是 Microsoft 的商標。",
          },
        ],
      },
      {
        heading: "你的責任",
        blocks: [
          {
            list: [
              "只對你本人擁有或有權存取的微軟帳號使用本工具，並遵守微軟對該帳號的服務條款。",
              "匯出的檔案包含你的個人資訊。請妥善保管，只匯入你信任的服務。",
              "不得利用本網站從事違法活動、攻擊本網站或其他系統，或妨礙他人正常使用。",
            ],
          },
          { links: [{ label: "Microsoft 服務合約", href: MS_TERMS }] },
        ],
      },
      {
        heading: "備份與準確性",
        blocks: [
          {
            p: "本工具只能匯出微軟介面提供的內容，部分內容（如「我的一天」和清單群組）無法取得。各目標應用程式只支援部分資料，微軟也可能在未另行通知的情況下修改或關閉介面。請檢查匯出的檔案，並保留 JSON 備份作為完整副本。",
          },
        ],
      },
      {
        heading: "不提供擔保",
        blocks: [
          {
            p: "本網站和本工具依「現狀」及「現有」提供，不作任何明示或默示的擔保，包括但不限於適售性、特定用途適用性和不侵權。我們不保證本網站始終可用、沒有錯誤，也不保證匯出結果完整或能被正確匯入。",
          },
        ],
      },
      {
        heading: "責任限制",
        blocks: [
          {
            p: "在法律允許的最大範圍內，對於因你使用或無法使用本網站而產生的任何間接、附帶、特殊或衍生性損失，以及任何資料、任務或利潤損失，我們不承擔責任，即使事先已被告知可能發生此類損失。部分司法管轄區不允許此類限制，因此上述限制可能不適用於你。",
          },
        ],
      },
      {
        heading: "開源授權",
        blocks: [
          {
            p: "原始碼以 GNU Affero 通用公共授權條款第 3 版（AGPL-3.0）授權。本條款約束你對本網站的使用，授權條款約束你對程式碼的使用。To Do 搬家與 Alchemew 的名稱和標誌不在授權範圍內。",
          },
          { links: [{ label: "GNU AGPL-3.0", href: AGPL }] },
        ],
      },
      {
        heading: "贊助",
        when: "donate",
        blocks: [
          {
            p: "贊助是對專案的自願支持，不購買任何服務、技術支援或功能。無論是否贊助，本工具都保持免費。",
          },
        ],
      },
      {
        heading: "網站與條款的變更",
        blocks: [
          {
            p: "我們可能隨時修改、暫停或停止本網站，也可能更新本條款，頁面頂端的日期即最新版本。變更後繼續使用本網站，即表示你接受更新後的條款。",
          },
        ],
      },
      {
        heading: "聯絡我們",
        contact: true,
        blocks: [{ p: "有關本條款的問題：" }],
      },
    ],
  },
};
