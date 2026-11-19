import { describe, expect, it } from "vitest";
import { classifyAuthError } from "./msal";

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
