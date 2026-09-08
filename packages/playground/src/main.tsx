// monaco worker 接线（宿主职责）——playground 用 vite 原生 worker 导入
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
// kernel 源码直通（vite alias）时其 src/index.ts 已自带样式导入，无需再引 dist/style.css
import './playground.css';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
