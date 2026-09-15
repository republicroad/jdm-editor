// monaco worker 接线（宿主职责）——monaco 全本地加载（无 CDN），姿势同
// kernel README「Self-hosting Monaco Editor」：打包 ESM monaco 实例交给
// @monaco-editor/react 的 loader，并按语言路由五类 worker。
// MPA 下仅编排/表达式类实例（graph / table）引入本模块，纯展示实例不背 monaco 体积。
import { loader } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

declare global {
  interface Window {
    monaco?: Monaco;
  }
}

let configured = false;

export const setupMonaco = (): void => {
  if (configured) return;
  configured = true;

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
};
