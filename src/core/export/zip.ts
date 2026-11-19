import JSZip from "jszip";
import type { ExportFile } from "../exporters/types";

const pad = (n: number) => String(n).padStart(2, "0");

/** todo-export-YYYYMMDD-HHmm.zip（按用户本地时间） */
export function zipFileName(now: Date = new Date()): string {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `todo-export-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`;
}

/** 打包为 zip。文件名使用 UTF-8（保留中文和 emoji）。 */
export async function makeZip(files: ExportFile[], now: Date = new Date()): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.content, { date: now });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", platform: "UNIX" });
}

/** 打包后的下载内容：一个文件时直接下载，多个文件时打成 zip（SPEC 3.6）。 */
export async function packageFiles(
  files: ExportFile[],
  now: Date = new Date(),
): Promise<{ name: string; data: string | Uint8Array; mime: string }> {
  if (files.length === 1) {
    const [file] = files;
    return { name: file!.path, data: file!.content, mime: file!.mime };
  }
  return { name: zipFileName(now), data: await makeZip(files, now), mime: "application/zip" };
}
