/** 浅色 / 深色切换按钮。选择保存在 localStorage，由 public/theme-init.js 在下次加载时提前应用。 */
export const THEME_STORAGE_KEY = "todo-mover:theme";

function effectiveTheme(): "light" | "dark" {
  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen === "light" || chosen === "dark") return chosen;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest("[data-theme-toggle]")) return;
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // 无法保存时只在本次访问内生效
  }
});
