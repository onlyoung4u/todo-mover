import { describe, expect, it, vi } from "vitest";
import { GraphClient, GraphError } from "./client";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const sleeps: number[] = [];
  const tokens: boolean[] = [];
  const client = new GraphClient({
    getToken: async ({ forceRefresh }) => {
      tokens.push(forceRefresh);
      return forceRefresh ? "fresh-token" : "token";
    },
    fetch: (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, headers: init.headers as Record<string, string> });
      return handler(url, init);
    }) as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { client, calls, sleeps, tokens };
}

describe("GraphClient", () => {
  it("sends auth and time zone headers and only GET requests", async () => {
    const { client, calls } = setup((_, init) => {
      expect(init.method).toBe("GET");
      return json({ ok: true });
    });
    await client.getJson("/me");
    expect(calls[0]!.url).toBe("https://graph.microsoft.com/v1.0/me");
    expect(calls[0]!.headers).toEqual({
      Authorization: "Bearer token",
      Prefer: 'outlook.timezone="UTC"',
    });
  });

  it("follows @odata.nextLink until the last page", async () => {
    const { client, calls } = setup((url) => {
      const page = Number(new URL(url).searchParams.get("page") ?? "1");
      return json({
        value: [page * 10, page * 10 + 1],
        ...(page < 3
          ? { "@odata.nextLink": `https://graph.microsoft.com/v1.0/me/todo/lists?page=${page + 1}` }
          : {}),
      });
    });
    expect(await client.getAll<number>("/me/todo/lists")).toEqual([10, 11, 20, 21, 30, 31]);
    expect(calls).toHaveLength(3);
  });

  it("refuses to send the token to another host", async () => {
    const { client, calls } = setup(() =>
      json({ value: [1], "@odata.nextLink": "https://evil.example.com/steal" }),
    );
    await expect(client.getAll("/me/todo/lists")).rejects.toMatchObject({
      code: "unexpected_host",
    });
    expect(calls).toHaveLength(1);
  });

  it("waits for Retry-After on 429 and 503", async () => {
    let n = 0;
    const { client, sleeps } = setup(() => {
      n++;
      if (n === 1) return new Response("", { status: 429, headers: { "Retry-After": "3" } });
      if (n === 2) return new Response("", { status: 503, headers: { "Retry-After": "1" } });
      return json({ done: true });
    });
    expect(await client.getJson("/x")).toEqual({ done: true });
    expect(sleeps).toEqual([3000, 1000]);
  });

  it("backs off exponentially without Retry-After and gives up after 5 retries", async () => {
    const { client, sleeps, calls } = setup(
      () =>
        new Response(JSON.stringify({ error: { code: "TooManyRequests", message: "slow down" } }), {
          status: 429,
        }),
    );
    const error = await client.getJson("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GraphError);
    expect(error).toMatchObject({ status: 429, code: "TooManyRequests", message: "slow down" });
    expect(sleeps).toEqual([1000, 2000, 4000, 8000, 16000]);
    expect(calls).toHaveLength(6);
  });

  it("refreshes the token once on 401", async () => {
    const { client, tokens } = setup((_, init) =>
      (init.headers as Record<string, string>).Authorization === "Bearer fresh-token"
        ? json({ ok: 1 })
        : new Response("", { status: 401 }),
    );
    expect(await client.getJson("/x")).toEqual({ ok: 1 });
    expect(tokens).toEqual([false, true]);
  });

  it("reports a persistent 401 and other errors without retrying", async () => {
    const { client, calls } = setup(() => new Response("", { status: 401 }));
    await expect(client.getJson("/x")).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(2);

    const forbidden = setup(() => new Response("", { status: 403 }));
    await expect(forbidden.client.getJson("/x")).rejects.toMatchObject({ status: 403 });
    expect(forbidden.calls).toHaveLength(1);
  });

  it("retries network errors", async () => {
    let n = 0;
    const { client, sleeps } = setup(() => {
      if (++n < 3) throw new TypeError("Failed to fetch");
      return json({ ok: 1 });
    });
    expect(await client.getJson("/x")).toEqual({ ok: 1 });
    expect(sleeps).toEqual([1000, 2000]);
  });

  it("runs at most 4 requests at once", async () => {
    let active = 0;
    let peak = 0;
    const { client } = setup(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return json({ ok: 1 });
    });
    await Promise.all(Array.from({ length: 12 }, (_, i) => client.getJson(`/x${i}`)));
    expect(peak).toBe(4);
  });

  it("keeps the slot until a slow body has been read", async () => {
    let reading = 0;
    let peak = 0;
    const slowBody = () =>
      new ReadableStream<Uint8Array>({
        async start(controller) {
          reading++;
          peak = Math.max(peak, reading);
          controller.enqueue(new Uint8Array([1]));
          await new Promise((r) => setTimeout(r, 5));
          controller.enqueue(new Uint8Array([2]));
          reading--;
          controller.close();
        },
      });
    const { client } = setup(() => new Response(slowBody()));
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => client.getBinary(`/file${i}/$value`)),
    );
    expect(results.every((r) => r.length === 2)).toBe(true);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("reads binary content", async () => {
    const { client } = setup(() => new Response(new Uint8Array([1, 2, 3])));
    expect(await client.getBinary("/file/$value")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("does not retry when the token provider fails", async () => {
    const getToken = vi.fn().mockRejectedValue(new Error("interaction required"));
    const client = new GraphClient({ getToken, fetch: vi.fn() as never, sleep: async () => {} });
    await expect(client.getJson("/x")).rejects.toThrow("interaction required");
    expect(getToken).toHaveBeenCalledTimes(1);
  });
});
