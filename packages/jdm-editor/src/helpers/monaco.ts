import type { Monaco } from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';

declare global {
  interface Window {
    monaco?: Monaco;
  }
}

// 配置Monaco环境，处理worker加载
self.MonacoEnvironment = {
  getWorkerUrl: function (workerId: string, label: string) {
    const baseUrl = import.meta.env.DEV ? '/monaco/min/vs' : './monaco/min/vs';
    // Monaco min版本使用统一的workerMain.js
    return `${baseUrl}/base/worker/workerMain.js`;
  }
};

// 配置Monaco使用本地静态文件（相对路径）
loader.config({
  paths: {
    vs: import.meta.env.DEV ? '/monaco/min/vs' : './monaco/min/vs'
  }
});
