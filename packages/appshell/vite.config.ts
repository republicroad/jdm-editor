import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// lib 构建（发布形态）。monorepo 内部消费走源码直通（main → src/index.ts），
// 外部消费方走 publishConfig 声明的 dist 入口。
export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      outDir: 'dist',
      include: ['src'],
      // 多文件声明（镜像 src 结构）。不用 bundleTypes/api-extractor：
      // 它会分析 import 闭包（含内核源码），对复杂 TS 构造有崩溃史且受
      // api-extractor 内置 TS 版本拖累——发布契约由 npm-smoke 聚合断言守护。
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // 宿主/内核均为外部：appshell 不打包 react 与内核
      external: ['react', 'react-dom', 'react/jsx-runtime', /^@republicroad\/jdm-editor(\/.*)?$/],
      output: {
        // css 统一命名 style.css，与 publishConfig exports("./dist/style.css") 对齐
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'style.css' : (asset.name ?? '[name]')),
      },
    },
    target: 'esnext',
  },
});
