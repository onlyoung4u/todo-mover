import type { Translate } from "../../i18n";

/** 界面上要区别处理的错误类型（SPEC 5.3） */
export type UiErrorKind =
  | "consentBlocked"
  | "misconfigured"
  | "cancelled"
  | "popupBlocked"
  | "sessionExpired"
  | "forbidden"
  | "network"
  | "other";

export type UiError = { kind: UiErrorKind; message: string };

/** 把 MSAL / Graph 的错误归类。不 import 它们的类，避免把 MSAL 打进首屏代码。 */
export function toUiError(error: unknown): UiError {
  const e = error as {
    name?: string;
    kind?: string;
    status?: number;
    code?: string;
    message?: string;
  };
  const message = e?.message ?? String(error);
  if (e?.name === "SignInError") {
    switch (e.kind) {
      case "consentBlocked":
      case "misconfigured":
      case "cancelled":
      case "popupBlocked":
        return { kind: e.kind, message };
      case "interactionRequired":
        return { kind: "sessionExpired", message };
    }
    return { kind: "other", message };
  }
  if (e?.name === "GraphError") {
    if (e.status === 401) return { kind: "sessionExpired", message };
    if (e.status === 403) return { kind: "forbidden", message };
    if (e.status === 0) return { kind: "network", message };
  }
  return { kind: "other", message };
}

export function errorText(error: UiError, t: Translate): string {
  switch (error.kind) {
    case "consentBlocked":
      return t("app.error.consentBlocked");
    case "misconfigured":
      return t("app.error.misconfigured", {
        uri: `${location.origin}/auth/redirect/`,
        message: error.message,
      });
    case "popupBlocked":
      return t("app.error.popupBlocked");
    case "sessionExpired":
      return t("app.error.sessionExpired");
    case "forbidden":
      return t("app.error.forbidden");
    case "network":
      return t("app.error.network");
    default:
      return t("app.error.other", { message: error.message });
  }
}
