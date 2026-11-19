import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // DOMParser 等浏览器 API（HTML 备注转纯文本）在测试中由 happy-dom 提供
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
