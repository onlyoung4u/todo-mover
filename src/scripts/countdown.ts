import { daysUntil } from "../core/countdown";

/** 落地页倒计时：构建时已输出一个值，这里按访问当天重新计算，避免静态页面数字过期。 */
for (const el of document.querySelectorAll<HTMLElement>("[data-countdown]")) {
  const target = el.dataset.countdown;
  const template = el.dataset.template;
  if (!target || !template) continue;
  el.textContent = template.replace("{days}", String(daysUntil(target)));
}
