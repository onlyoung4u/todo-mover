import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthSession, REFRESH_DEDUPE_MS, classifyAuthError } from "./msal";

const err = (errorCode: string, message: string) =>
  Object.assign(new Error(message), { errorCode });

describe("classifyAuthError (SPEC 5.3)", () => {
  it.each([
    [
      err("invalid_client", "AADSTS70002: The provided request must include a 'client_secret'"),
      "misconfigured",
    ],
    [
      err(
        "invalid_request",
        "AADSTS9002326: Cross-origin token redemption is permitted only for the 'Single-Page Application' client-type.",
      ),
      "misconfigured",
    ],
    [
      err(
        "invalid_request",
        "AADSTS50011: The redirect URI specified in the request does not match",
      ),
      "misconfigured",
    ],
    [
      err("consent_required", "AADSTS65001: The user or administrator has not consented"),
      "consentBlocked",
    ],
    [err("access_denied", "AADSTS90094: Admin approval required"), "consentBlocked"],
    [err("user_cancelled", "User cancelled the flow."), "cancelled"],
    [err("popup_window_error", "Error opening popup window."), "popupBlocked"],
    [err("empty_window_error", "window.open returned null"), "popupBlocked"],
    [err("no_account_error", "No account object provided"), "interactionRequired"],
    [new Error("something else"), "other"],
  ])("%#", (error, kind) => {
    expect(classifyAuthError(error).kind).toBe(kind);
  });
});

describe("AuthSession.getToken", () => {
  afterEach(() => vi.useRealTimers());

  /** 用假的 MSAL 实例构造 AuthSession（构造函数是私有的，只在测试里绕过） */
  function session({ silentFails = false } = {}) {
    const calls = { silent: 0, forced: 0, popup: 0 };
    const pca = {
      getActiveAccount: () => ({ homeAccountId: "a", username: "user@example.com" }),
      setActiveAccount: () => {},
      clearCache: async () => {},
      loginPopup: async () => ({ account: { homeAccountId: "b", username: "other@example.com" } }),
      acquireTokenSilent: async ({ forceRefresh }: { forceRefresh?: boolean }) => {
        calls.silent++;
        if (forceRefresh) calls.forced++;
        await Promise.resolve();
        if (silentFails) throw new InteractionRequiredAuthError("interaction_required", "");
        return { accessToken: forceRefresh ? `fresh-${calls.forced}` : "cached" };
      },
      acquireTokenPopup: async () => {
        calls.popup++;
        await Promise.resolve();
        return { accessToken: `popup-${calls.popup}` };
      },
    };
    const Ctor = AuthSession as unknown as new (pca: unknown) => AuthSession;
    return { s: new Ctor(pca), calls };
  }

  it("shares one forced refresh between concurrent 401 retries", async () => {
    const { s, calls } = session();
    const tokens = await Promise.all(
      Array.from({ length: 10 }, () => s.getToken({ forceRefresh: true })),
    );
    expect(calls.forced).toBe(1);
    expect(new Set(tokens)).toEqual(new Set(["fresh-1"]));
  });

  it("does not force another refresh right after one, but does later", async () => {
    vi.useFakeTimers();
    const { s, calls } = session();
    await s.getToken({ forceRefresh: true });
    expect(await s.getToken({ forceRefresh: true })).toBe("cached");
    expect(calls.forced).toBe(1);
    vi.advanceTimersByTime(REFRESH_DEDUPE_MS + 1);
    expect(await s.getToken({ forceRefresh: true })).toBe("fresh-2");
  });

  it("opens a single popup when several silent requests fail at once", async () => {
    const { s, calls } = session({ silentFails: true });
    const tokens = await Promise.all(Array.from({ length: 5 }, () => s.getToken()));
    expect(calls.popup).toBe(1);
    expect(new Set(tokens)).toEqual(new Set(["popup-1"]));
  });

  it("resets the forced-refresh cooldown after signOut", async () => {
    vi.useFakeTimers();
    const { s, calls } = session();
    await s.getToken({ forceRefresh: true });
    expect(calls.forced).toBe(1);
    await s.signOut();
    await s.signInPopup();
    expect(await s.getToken({ forceRefresh: true })).toBe("fresh-2");
    expect(calls.forced).toBe(2);
  });
});
