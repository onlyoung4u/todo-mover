import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type ContentCollection = "guides" | "faq";

function isDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 判断某个集合目录里是否至少包含一个有效内容文件：
 * - guides：`<语言>/<slug>.md`（至少一个非隐藏子目录内含 `.md` 文件）
 * - faq：`<语言>.yaml` 或 `.yml`（至少一个 YAML 文件）
 *
 * 只判断目录存在是不够的：空目录或仅含 `.gitkeep` 时不应把公开示例替换成 0 篇。
 */
export function hasCollectionFiles(dir: string, collection: ContentCollection): boolean {
  if (!isDirectory(dir)) return false;

  const entries = readdirSync(dir, { withFileTypes: true });
  if (collection === "faq") {
    return entries.some(
      (entry) => entry.isFile() && !entry.name.startsWith(".") && /\.(ya?ml)$/i.test(entry.name),
    );
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const subDir = path.join(dir, entry.name);
    if (!entry.isDirectory() && !(entry.isSymbolicLink() && isDirectory(subDir))) continue;
    const files = readdirSync(subDir, { withFileTypes: true });
    if (
      files.some((file) => file.isFile() && !file.name.startsWith(".") && file.name.endsWith(".md"))
    ) {
      return true;
    }
  }
  return false;
}

export interface ResolveContentOptions {
  /** 私有内容根目录，默认取环境变量 CONTENT_DIR 或 "private-content" */
  contentDir?: string;
  /** 工作目录，默认 process.cwd() */
  cwd?: string;
}

/**
 * 按集合决定内容根目录：私有内容下至少有一个内容文件时整体替换公开示例，否则回退到 src/content/<集合>。
 */
export function resolveContentBase(
  collection: ContentCollection,
  options: ResolveContentOptions = {},
): string {
  const cwd = options.cwd ?? process.cwd();
  const rawPrivateDir = options.contentDir ?? process.env.CONTENT_DIR;
  const privateRoot = rawPrivateDir?.trim() || "private-content";
  const privateDir = path.resolve(cwd, privateRoot, collection);

  if (hasCollectionFiles(privateDir, collection)) {
    return privateDir;
  }
  return path.resolve(cwd, "src/content", collection);
}

/** 返回传给 Astro glob loader 的绝对文件 URL（同时兼容相对路径、../ 路径与绝对路径）。 */
export function resolveContentBaseUrl(
  collection: ContentCollection,
  options: ResolveContentOptions = {},
): URL {
  return pathToFileURL(resolveContentBase(collection, options));
}
