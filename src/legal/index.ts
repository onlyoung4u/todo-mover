import type { LegalDoc, LegalSection } from "./types";

export { PRIVACY } from "./privacy";
export { TERMS } from "./terms";
export { LEGAL_UPDATED } from "./types";
export type { LegalBlock, LegalDoc, LegalDocs, LegalSection } from "./types";

/** 按当前构建的配置过滤条件小节（未启用统计 / 打赏时不出现对应说明）。 */
export function visibleSections(
  doc: LegalDoc,
  enabled: { analytics: boolean; donate: boolean },
): LegalSection[] {
  return doc.sections.filter((s) => !s.when || enabled[s.when]);
}
