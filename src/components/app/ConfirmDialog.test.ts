import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

// React 需要这个标记才允许在测试里使用 act()
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = "";
});

function render(onAnswer: (confirmed: boolean) => void) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      createElement(ConfirmDialog, {
        message: "About 300 MB. Download all?",
        confirmLabel: "Download all",
        cancelLabel: "Skip attachments",
        onAnswer,
      }),
    ),
  );
  const dialog = container.querySelector("dialog")!;
  const button = (label: string) =>
    Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === label)!;
  return { dialog, button };
}

describe("ConfirmDialog", () => {
  it("opens as a modal and reports the choice once", () => {
    const onAnswer = vi.fn();
    const { dialog, button } = render(onAnswer);
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("About 300 MB");

    act(() => button("Download all").click());
    act(() => button("Skip attachments").click());
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(dialog.open).toBe(false);
  });

  it("treats Escape (cancel) as no", () => {
    const onAnswer = vi.fn();
    const { dialog } = render(onAnswer);
    act(() => {
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});
