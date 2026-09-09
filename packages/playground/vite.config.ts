import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// 仓内消费者一律源码直通（两个 workspace 包的 dist 是发布产物，存在 pnpm
// 硬链接副本陈旧问题——见 docs/troubleshooting 案例 8）；monaco 用宿主安装版。
// kernel 源码的 tailwind.css 未编译，需 @tailwindcss/vite 处理。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@republicroad/jdm-editor': fileURLToPath(new URL('../jdm-editor/src/index.ts', import.meta.url)),
      '@republicroad/jdm-appshell': fileURLToPath(new URL('../appshell/src/index.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    // 两个 workspace 包必须源码直通且不预打包：预打包会把当时的 dist 冻结成
    // 副本（双实例：store/context 断裂 → 白屏），且 kernel dist 变化会触发整页
    // 强制 reload。exclude 后走 resolve.alias 的源码直通。
    exclude: ['@republicroad/jdm-editor', '@republicroad/jdm-appshell', '@gorules/zen-engine-wasm'],
  },
});
