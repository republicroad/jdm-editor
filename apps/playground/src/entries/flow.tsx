import { ThemeContextProvider } from '@republicroad/jdm-appshell';
import React from 'react';
import { createRoot } from 'react-dom/client';

// ReUI flow-1 试点：自动化工作流画布块（xyflow v12 + ReUI/shadcn 组件）。
// 块自带全屏顶栏（h-svh），故不走 InstanceShell；返回目录链接已 patch 进块顶栏。
// 评估目的见 docs/design/reui-flow-pilot.md（可搬部件 / 源码直通配合 / trace 监控可行性）。
import { Page } from '../components/blocks/flow-1/page';
import '../playground.css';
import '../theme.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeContextProvider>
      <Page />
    </ThemeContextProvider>
  </React.StrictMode>,
);
