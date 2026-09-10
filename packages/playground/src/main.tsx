// monaco worker 接线（宿主职责）——monaco 全本地加载（无 CDN），姿势同
// kernel README「Self-hosting Monaco Editor」：打包 ESM monaco 实例交给
// @monaco-editor/react 的 loader，并按语言路由五类 worker。
import { loader } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './playground.css';
// kernel 源码直通（vite alias）时其 src/index.ts 已自带样式导入，无需再引 dist/style.css
import './theme.css';

declare global {
  interface Window {
    monaco?: Monaco;
  }
}

self.monaco = monaco;

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

loader.config({ monaco });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
