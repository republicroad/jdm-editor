import React from 'react';
import { createRoot } from 'react-dom/client';

import { GraphPlayground } from '../graph-playground';
import '../playground.css';
import { setupMonaco } from '../shared/monaco-setup';
import '../theme.css';

setupMonaco();

// Decision Graph 实例入口（graph.html）
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GraphPlayground />
  </React.StrictMode>,
);
