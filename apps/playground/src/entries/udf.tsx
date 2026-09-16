import React from 'react';
import { createRoot } from 'react-dom/client';

import '../playground.css';
import { setupMonaco } from '../shared/monaco-setup';
import '../theme.css';
import { UdfLab } from '../udf-lab';

setupMonaco();

// Custom Nodes 实例入口（udf.html）：编排 → 仿真 → Trust Chain 三段式工作台
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UdfLab />
  </React.StrictMode>,
);
