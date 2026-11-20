/*
 * 在页面绘制前应用用户手动选择的浅色 / 深色主题，避免闪烁。
 * 同步加载的同源外部脚本（CSP 只允许 'self' 和带哈希的内联脚本）。
 * 没有手动选择时不设置 data-theme，跟随系统。
 */
(function () {
  try {
    var theme = localStorage.getItem("todo-mover:theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch {
    // 隐私模式等情况下 localStorage 不可用，跟随系统
  }
})();
