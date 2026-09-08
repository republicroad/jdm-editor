import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // kernel 走源码直通：测试 import 运行时符号时解析 dist 会连带要求
      // monaco 等 peer 真装在 appshell 测试环境（见 custom-node-button 测试）
      '@republicroad/jdm-editor': fileURLToPath(new URL('../jdm-editor/src/index.ts', import.meta.url)),
      'monaco-editor': fileURLToPath(new URL('../jdm-editor/src/test-stubs/monaco-editor-stub.ts', import.meta.url)),
    },
  },
  test: {
    // 缺省 node；组件测试按文件用 `@vitest-environment jsdom` 逐个开启
    environment: 'node',
    globals: false,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
});
