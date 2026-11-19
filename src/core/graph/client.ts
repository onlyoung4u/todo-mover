/**
 * Microsoft Graph 请求封装（SPEC 6.1）：
 * - 鉴权头；401 时强制刷新一次 token 再重试
 * - 全局最多 4 个并发请求
 * - 429 / 503：按 Retry-After 等待，没有则指数退避（1s、2s、4s… 最多 5 次）
 * - 分页：跟随 @odata.nextLink，直到没有为止
 * - 每个请求带 Prefer: outlook.timezone="UTC"
 * 只发 GET 请求；token 只会发往 graph.microsoft.com。
 */
import type { GraphCollection } from "./types";

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export type TokenProvider = (options: { forceRefresh: boolean }) => Promise<string>;

export class GraphError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GraphError";
  }
}

export type GraphClientOptions = {
  getToken: TokenProvider;
  fetch?: typeof fetch;
  maxConcurrency?: number;
  maxRetries?: number;
  /** 测试时替换为假的等待函数 */
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
};

const RETRYABLE = new Set([429, 503]);

/** 简单的信号量，限制同时进行的请求数 */
class Limiter {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private readonly max: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

/** Retry-After 可能是秒数，也可能是 HTTP 日期 */
function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

async function errorFrom(response: Response): Promise<GraphError> {
  let code = `http_${response.status}`;
  let message = response.statusText || code;
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    if (body.error?.code) code = body.error.code;
    if (body.error?.message) message = body.error.message;
  } catch {
    // 响应体不是 JSON
  }
  return new GraphError(response.status, code, message);
}

export class GraphClient {
  private readonly limiter: Limiter;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly baseUrl: string;
  private readonly origin: string;

  constructor(private readonly options: GraphClientOptions) {
    this.limiter = new Limiter(options.maxConcurrency ?? 4);
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = options.maxRetries ?? 5;
    this.baseUrl = options.baseUrl ?? GRAPH_BASE;
    this.origin = new URL(this.baseUrl).origin;
  }

  /** 相对路径拼到 v1.0 下；绝对地址（nextLink）必须仍指向 Graph */
  private resolve(pathOrUrl: string): string {
    const url = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
    if (new URL(url).origin !== this.origin) {
      throw new GraphError(0, "unexpected_host", `Refusing to send credentials to ${url}`);
    }
    return url;
  }

  private async send(pathOrUrl: string): Promise<Response> {
    const url = this.resolve(pathOrUrl);
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const token = await this.options.getToken({ forceRefresh: refreshed });
      let response: Response;
      try {
        response = await this.limiter.run(() =>
          this.fetchImpl(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              Prefer: 'outlook.timezone="UTC"',
            },
          }),
        );
      } catch (networkError) {
        // 网络错误同样按指数退避重试
        if (attempt >= this.maxRetries) {
          throw new GraphError(0, "network_error", String(networkError));
        }
        await this.sleep(1000 * 2 ** attempt);
        continue;
      }

      if (response.ok) return response;

      if (response.status === 401 && !refreshed) {
        refreshed = true;
        attempt--; // 刷新 token 不计入重试次数
        continue;
      }
      if (RETRYABLE.has(response.status) && attempt < this.maxRetries) {
        await this.sleep(retryAfterMs(response.headers.get("Retry-After")) ?? 1000 * 2 ** attempt);
        continue;
      }
      throw await errorFrom(response);
    }
  }

  async getJson<T>(pathOrUrl: string): Promise<T> {
    const response = await this.send(pathOrUrl);
    return (await response.json()) as T;
  }

  /** 读取集合接口的全部分页 */
  async getAll<T>(pathOrUrl: string): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = pathOrUrl;
    while (next) {
      const page: GraphCollection<T> = await this.getJson<GraphCollection<T>>(next);
      items.push(...(page.value ?? []));
      next = page["@odata.nextLink"];
    }
    return items;
  }

  async getBinary(pathOrUrl: string): Promise<Uint8Array> {
    const response = await this.send(pathOrUrl);
    return new Uint8Array(await response.arrayBuffer());
  }
}
