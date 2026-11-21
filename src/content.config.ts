/**
 * 站点内容（指南、常见问题）。SEO / GEO 用的页面模板和结构化数据都在公开仓库里，
 * 内容分两层：
 * - src/content/<集合>/：公开示例，自部署的人拿到的就是这些，站点照样完整可用；
 * - private-content/<集合>/：正式站点的内容，来自私有仓库，CI 部署时复制 guides/ 和 faq/ 到这里（已加入 .gitignore）。
 *
 * 合并规则：某个集合在 private-content/ 下至少有一个有效内容文件时整体替换对应的公开示例，
 * 不做逐篇合并；空目录或仅含占位文件时会回退到公开示例。
 * 也可以用环境变量 CONTENT_DIR 指定私有内容根目录。
 *
 * Schema 兼容约定：新增字段一律设为可选或提供默认值；重命名或删除字段分两步过渡，
 * 避免私有仓库 PR 在预发 / 正式双代码版本构建中冲突。
 */
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { resolveContentBaseUrl } from "./lib/contentDir";

/** 保留路径原样作为 ID（默认会转小写，把 zh-CN 变成 zh-cn） */
const keepPath = ({ entry }: { entry: string }) => entry.replace(/\.(md|ya?ml|json)$/, "");

const qa = z.object({
  q: z.string().min(1),
  /** 纯文本；空行分段 */
  a: z.string().min(1),
});

/**
 * 指南：guides/<语言>/<slug>.md。同一个 slug 在不同语言下视为同一篇的译文，
 * 页面之间用 hreflang 互指；某种语言没有这篇时不生成该语言的页面。
 */
const guides = defineCollection({
  loader: glob({
    pattern: "*/*.md",
    base: resolveContentBaseUrl("guides"),
    generateId: keepPath,
  }),
  schema: z.object({
    title: z.string().min(1),
    /** <meta name="description">，也用于指南列表和 llms.txt */
    description: z.string().min(1).max(200),
    /** 页首的"直接回答"：一两句话回答标题里的问题，便于搜索摘要和 AI 引用 */
    answer: z.string().min(1),
    /** 最后核实内容的日期，显示在页面上并写入结构化数据（统一按 UTC 格式化） */
    updated: z.coerce.date(),
    /** 可选：关联的目标应用或场景（如 backup、todoist、obsidian、things、ics、csv、ticktick） */
    target: z.string().min(1).optional(),
    /** 操作步骤：显示为有序列表，并生成 HowTo 结构化数据（为空时不输出该节点） */
    steps: z.array(z.object({ name: z.string().min(1), text: z.string().min(1) })).default([]),
    /** 文末问答：显示在正文底部，并生成 FAQPage 结构化数据（为空时不输出该节点） */
    faq: z.array(qa).default([]),
    /** 引用来源：事实性内容（日期、政策）应注明出处 */
    sources: z.array(z.object({ title: z.string().min(1), url: z.url() })).default([]),
    /** 列表排序，小的在前 */
    order: z.number().default(100),
    draft: z.boolean().default(false),
  }),
});

/** 常见问题：faq/<语言>.yaml，每种语言一个文件 */
const faq = defineCollection({
  loader: glob({
    pattern: "*.{yaml,yml}",
    base: resolveContentBaseUrl("faq"),
    generateId: keepPath,
  }),
  schema: z.object({
    updated: z.coerce.date(),
    items: z.array(qa).min(1),
  }),
});

export const collections = { guides, faq };
