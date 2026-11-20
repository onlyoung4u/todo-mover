import { useEffect, useId, useRef } from "react";

type Props = {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** 用户的选择；按 Esc 关闭视为取消 */
  onAnswer: (confirmed: boolean) => void;
};

/**
 * 页内确认框，替代 window.confirm（部分浏览器环境会禁用原生对话框）。
 * 使用原生 <dialog> 的 showModal：自带焦点限制、Esc 关闭和背景遮罩。
 */
export function ConfirmDialog({ message, confirmLabel, cancelLabel, onAnswer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const messageId = useId();
  const answered = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const answer = (confirmed: boolean) => {
    if (answered.current) return;
    answered.current = true;
    ref.current?.close();
    onAnswer(confirmed);
  };

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-describedby={messageId}
      onCancel={(e) => {
        e.preventDefault();
        answer(false);
      }}
    >
      <p id={messageId}>{message}</p>
      <div className="button-row">
        <button type="button" className="button" onClick={() => answer(false)}>
          {cancelLabel}
        </button>
        <button type="button" className="button primary" autoFocus onClick={() => answer(true)}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
