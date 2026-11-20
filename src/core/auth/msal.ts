/**
 * Microsoft 登录（SPEC 第 5 节）。只在浏览器中使用。
 * - authority：common（个人账号 + 工作/学校账号）
 * - token 只存 sessionStorage，关闭标签页即清除
 * - 回调页 /auth/redirect/ 只负责把结果交回主窗口（见 src/pages/auth/redirect.astro）
 * - 本项目绝不调用任何写接口；即使拿到 Tasks.ReadWrite 也只用于读取
 */
import {
  BrowserAuthError,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from "@azure/msal-browser";

export const READ_SCOPES = ["User.Read", "Tasks.Read"];
/** 个人账号仅授 Tasks.Read 时读取附件返回 401（SPEC 13 #13），此时再以增量授权方式申请 */
export const READ_WRITE_SCOPES = ["User.Read", "Tasks.ReadWrite"];

/** 强制刷新 token 后的这段时间内，不再重复强制刷新 */
export const REFRESH_DEDUPE_MS = 30_000;

export type AuthErrorKind =
  /** 组织禁止用户自行授权第三方应用 */
  | "consentBlocked"
  /** Azure 应用注册有误：回调地址不是 SPA 平台，或没有登记当前地址 */
  | "misconfigured"
  /** 用户关闭了弹窗：静默处理 */
  | "cancelled"
  /** 浏览器拦截了弹窗：提示允许弹窗，或改用跳转方式登录 */
  | "popupBlocked"
  /** 需要重新登录（token 过期且无法静默续期） */
  | "interactionRequired"
  | "other";

export class SignInError extends Error {
  constructor(
    public readonly kind: AuthErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SignInError";
  }
}

/** 按 SPEC 5.3 识别登录错误。 */
export function classifyAuthError(error: unknown): SignInError {
  if (error instanceof SignInError) return error;
  const code = (error as { errorCode?: string })?.errorCode ?? "";
  const message = error instanceof Error ? error.message : String(error);
  const text = `${code} ${message}`;
  // AADSTS70002 / AADSTS9002326：回调地址登记在 Web 平台而不是 SPA；AADSTS50011：回调地址未登记
  if (/AADSTS70002|AADSTS9002326|AADSTS50011/.test(text)) {
    return new SignInError("misconfigured", message);
  }
  if (/AADSTS65001|AADSTS90094|admin approval|admin consent/i.test(text)) {
    return new SignInError("consentBlocked", message);
  }
  if (code === "user_cancelled") return new SignInError("cancelled", message);
  if (code === "popup_window_error" || code === "empty_window_error") {
    return new SignInError("popupBlocked", message);
  }
  if (error instanceof InteractionRequiredAuthError || code === "no_account_error") {
    return new SignInError("interactionRequired", message);
  }
  return new SignInError("other", message);
}

export type SessionAccount = { displayName?: string; username?: string };

export class AuthSession {
  private scopes = READ_SCOPES;

  private constructor(private readonly pca: PublicClientApplication) {}

  /**
   * 初始化 MSAL，并处理跳转方式登录回来的结果（handleRedirectPromise）。
   * 返回的 signedInByRedirect 为 true 表示刚刚通过跳转完成了登录。
   */
  static async create(
    clientId: string,
  ): Promise<{ session: AuthSession; signedInByRedirect: boolean }> {
    const pca = new PublicClientApplication({
      auth: {
        clientId,
        authority: "https://login.microsoftonline.com/common",
        redirectUri: `${location.origin}/auth/redirect/`,
        postLogoutRedirectUri: null,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    await pca.initialize();
    const session = new AuthSession(pca);
    const result = await pca.handleRedirectPromise();
    if (result?.account) pca.setActiveAccount(result.account);
    else if (!pca.getActiveAccount()) {
      const [first] = pca.getAllAccounts();
      if (first) pca.setActiveAccount(first);
    }
    if (result?.scopes.some((s) => /Tasks\.ReadWrite/i.test(s))) session.scopes = READ_WRITE_SCOPES;
    return { session, signedInByRedirect: Boolean(result?.account) };
  }

  get account(): AccountInfo | null {
    return this.pca.getActiveAccount();
  }

  /** 弹窗登录 */
  async signInPopup(): Promise<AccountInfo> {
    try {
      const result = await this.pca.loginPopup({ scopes: this.scopes, prompt: "select_account" });
      this.pca.setActiveAccount(result.account);
      return result.account;
    } catch (e) {
      throw classifyAuthError(e);
    }
  }

  /** 弹窗被拦截时的备选：整页跳转登录，回来后由 create() 处理结果 */
  async signInRedirect(): Promise<void> {
    await this.pca.loginRedirect({ scopes: this.scopes, prompt: "select_account" });
  }

  /** 进行中的强制刷新：并发请求同时收到 401 时共用一次刷新 */
  private refreshing?: Promise<string>;
  /** 进行中的弹窗：静默获取同时失败时只弹一个窗口 */
  private interactive?: Promise<string>;
  /** 上次强制刷新完成的时间；刚刷新过就不再重复刷新，直接用缓存里的新 token */
  private refreshedAt = -Infinity;

  /**
   * 先静默获取，失败再弹窗（SPEC 5.2）。
   * forceRefresh 用于 Graph 返回 401 后重试：并发的强制刷新合并为一次，
   * 刷新后 REFRESH_DEDUPE_MS 内的强制刷新请求直接返回缓存中的 token。
   * 这样只读权限下大量附件请求被拒时，不会反复向微软刷新 token 或连续弹窗。
   */
  getToken({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<string> {
    if (!forceRefresh || Date.now() - this.refreshedAt < REFRESH_DEDUPE_MS) {
      return this.acquire(false);
    }
    this.refreshing ??= this.acquire(true)
      .then((token) => {
        this.refreshedAt = Date.now();
        return token;
      })
      .finally(() => {
        this.refreshing = undefined;
      });
    return this.refreshing;
  }

  private async acquire(forceRefresh: boolean): Promise<string> {
    const account = this.account;
    if (!account) throw new SignInError("interactionRequired", "Not signed in");
    try {
      const result = await this.pca.acquireTokenSilent({
        scopes: this.scopes,
        account,
        forceRefresh,
      });
      return result.accessToken;
    } catch (e) {
      if (!(e instanceof InteractionRequiredAuthError) && !(e instanceof BrowserAuthError)) {
        throw classifyAuthError(e);
      }
      return this.popup(account);
    }
  }

  private popup(account: AccountInfo): Promise<string> {
    this.interactive ??= this.pca
      .acquireTokenPopup({ scopes: this.scopes, account })
      .then(
        (result) => result.accessToken,
        (popupError: unknown) => {
          throw classifyAuthError(popupError);
        },
      )
      .finally(() => {
        this.interactive = undefined;
      });
    return this.interactive;
  }

  /** 增量授权 Tasks.ReadWrite（仅在 Tasks.Read 读取被拒时由用户主动触发） */
  async requestReadWrite(): Promise<void> {
    try {
      const result = await this.pca.acquireTokenPopup({
        scopes: READ_WRITE_SCOPES,
        account: this.account ?? undefined,
      });
      this.pca.setActiveAccount(result.account);
      this.scopes = READ_WRITE_SCOPES;
    } catch (e) {
      throw classifyAuthError(e);
    }
  }

  /** 退出登录：只清除本站在浏览器中保存的登录状态，不会让用户退出其他微软服务 */
  async signOut(): Promise<void> {
    await this.pca.clearCache();
    this.pca.setActiveAccount(null);
    this.scopes = READ_SCOPES;
  }
}
