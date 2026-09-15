import React from 'react';
import { createRoot } from 'react-dom/client';

import { DirectoryPage } from './directory-page';
import './playground.css';
// kernel 源码直通（vite alias）时其 src/index.ts 已自带样式导入，无需再引 dist/style.css
import './theme.css';

// MPA 目录页入口（index.html）：纯导航，不引 monaco。
// 各实例入口见 src/entries/*.tsx（graph/table 实例各自接线 monaco worker）。
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DirectoryPage />
  </React.StrictMode>,
);
