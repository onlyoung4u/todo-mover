import { config, donateUrlFor } from "../../config";
import type { ExporterId } from "../../core/exporters/types";
import type { MessageKey } from "../../i18n";
import { useI18n } from "./i18n";
import { CheckIcon, DownloadIcon } from "./icons";

export type DoneResult = {
  fileName: string;
  formats: ExporterId[];
  links: { label: string; url: string }[];
  warnings: string[];
};

type Guide = { title: MessageKey; steps: MessageKey; link?: string };

/** 导入指引（SPEC 第 8 节）。没有官方文档的应用不放链接。 */
function guidesFor(formats: ExporterId[], ticktickLink: string): Guide[] {
  const byFormat: Record<ExporterId, Guide[]> = {
    json: [{ title: "guide.json.title", steps: "guide.json.steps" }],
    csv: [
      {
        title: "guide.excel.title",
        steps: "guide.excel.steps",
        link: "https://support.microsoft.com/office/opening-csv-utf-8-files-correctly-in-excel-8a935af5-3416-4edd-ba7e-3dfd2bc4a032",
      },
    ],
    markdown: [
      {
        title: "guide.obsidian.title",
        steps: "guide.obsidian.steps",
        link: "https://publish.obsidian.md/tasks/Reference/Task+Formats/Tasks+Emoji+Format",
      },
    ],
    ics: [
      { title: "guide.thunderbird.title", steps: "guide.thunderbird.steps" },
      { title: "guide.nextcloud.title", steps: "guide.nextcloud.steps" },
    ],
    todoist: [
      {
        title: "guide.todoist.title",
        steps: "guide.todoist.steps",
        link: "https://todoist.com/help/articles/208821185",
      },
    ],
    things: [
      {
        title: "guide.things.title",
        steps: "guide.things.steps",
        link: "https://culturedcode.com/things/help/url-scheme/",
      },
    ],
  };
  return [
    ...formats.flatMap((f) => byFormat[f]),
    { title: "guide.ticktick.title", steps: "guide.ticktick.steps", link: ticktickLink },
  ];
}

type Props = {
  result: DoneResult;
  signedIn: boolean;
  onDownloadAgain: () => void;
  onBack: () => void;
};

export function DoneScreen({ result, signedIn, onDownloadAgain, onBack }: Props) {
  const { t, locale } = useI18n();
  const donateUrl = donateUrlFor(locale);
  const ticktickLink =
    locale === "zh-CN"
      ? "https://help.dida365.com/"
      : "https://help.ticktick.com/articles/7055781405648748544";
  const guides = guidesFor(result.formats, ticktickLink);

  return (
    <section className="done-screen">
      <p className="eyebrow">
        <span className="dot" />
        {t("app.done.eyebrow")}
      </p>
      <h1>{t("app.done.heading")}</h1>
      <div className="window done-window">
        <div className="done-file">
          <span className="done-check" aria-hidden="true">
            <CheckIcon size={20} />
          </span>
          <div>
            <p className="muted">{t("app.done.downloadedLabel")}</p>
            <span className="chip accent">{result.fileName}</span>
          </div>
          <span className="spacer" />
          <span className="button-row">
            <button type="button" className="button" onClick={onDownloadAgain}>
              <DownloadIcon />
              {t("app.done.downloadAgain")}
            </button>
            <button type="button" className="button" onClick={onBack}>
              {t("app.done.backToPreview")}
            </button>
          </span>
        </div>
      </div>

      {result.links.length > 0 && (
        <div className="card things-card">
          <h2>{t("app.done.things.heading")}</h2>
          <p className="hint">{t("app.done.things.hint")}</p>
          <ul className="things-links">
            {result.links.map((link, i) => (
              // 两个同名空清单会生成相同的链接，用序号区分
              <li key={i}>
                <span>{link.label}</span>
                <a className="button small" href={link.url}>
                  {t("app.done.things.open")}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <details className="card warnings">
          <summary>{t("app.done.warnings", { count: result.warnings.length })}</summary>
          <ul>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="eyebrow section-eyebrow">{t("app.done.guidesEyebrow")}</p>
      <h2>{t("app.done.guides")}</h2>
      <div className={`guides${guides.length === 4 ? " guides-even" : ""}`}>
        {guides.map((g) => (
          <div key={g.title} className="card guide">
            <h3>{t(g.title)}</h3>
            <ol>
              {t(g.steps)
                .split("\n")
                .map((step) => (
                  <li key={step}>{step}</li>
                ))}
            </ol>
            {g.link && (
              <a href={g.link} target="_blank" rel="noopener noreferrer">
                {t("app.done.officialHelp")}
              </a>
            )}
          </div>
        ))}
      </div>

      {signedIn && (
        <div className="card revoke-card">
          <h2>{t("app.done.revoke.heading")}</h2>
          <p>
            {t("app.done.revoke.personal")}{" "}
            <a
              href="https://account.live.com/consent/Manage"
              target="_blank"
              rel="noopener noreferrer"
            >
              account.live.com/consent/Manage
            </a>
          </p>
          <p>
            {t("app.done.revoke.work")}{" "}
            <a href="https://myapps.microsoft.com" target="_blank" rel="noopener noreferrer">
              myapps.microsoft.com
            </a>
          </p>
        </div>
      )}

      <div className="thanks">
        {donateUrl && (
          <p>
            {t("app.done.donate")}{" "}
            <a className="button small" href={donateUrl} target="_blank" rel="noopener noreferrer">
              {t("footer.donate")}
            </a>
          </p>
        )}
        <p>
          {t("app.done.follow")}{" "}
          <a href={config.repoUrl} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </div>
    </section>
  );
}
