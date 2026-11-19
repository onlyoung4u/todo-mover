import { getTranslator, type Locale } from "../../i18n";

type Props = {
  locale: Locale;
};

/** 导出工具入口（M3 起实现完整流程）。只在浏览器中渲染（client:only），因为 MSAL 依赖浏览器环境。 */
export default function ExportApp({ locale }: Props) {
  const t = getTranslator(locale);
  return (
    <section>
      <h1>{t("app.title")}</h1>
      <p className="muted">{t("app.placeholder")}</p>
    </section>
  );
}
