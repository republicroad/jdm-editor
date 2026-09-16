import dts from 'unplugin-dts/vite';
import { defineConfig } from 'vite';

// lib 构建（发布形态）。monorepo 内部消费走源码直通（main → src/index.ts），
// 外部消费方走 publishConfig 声明的 dist 入口。
export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      outDir: 'dist',
      // 发布契约：保留源码里的包名导入（@republicroad/jdm-editor / react 等），
      // 不把 tsconfig paths 转写为构建机相对路径——npm 消费方拿到的 d.ts 必须
      // 只含可解析的包名 specifier（0.9.0 泄漏 ../../../../jdm-editor/src/* 的修复）。
      pathsToAliases: false,
      // kernel 的 ambient 模块声明（@gorules/lezer-zen 等）必须进 dts 程序，
      // 否则跨包解析 kernel src 时 TS7016（appshell tsconfig 的 include 被
      // 此处覆盖）。
      include: ['src', '../jdm-editor/src/types/*.d.ts'],
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
    rolldownOptions: {
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
