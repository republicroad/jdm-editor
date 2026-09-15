import React from 'react';
import { createRoot } from 'react-dom/client';

import { DataGridPage } from '../data-grid-page';
import '../playground.css';
import { InstanceShell } from '../shared/instance-shell';
import '../theme.css';

// Data Grid 实例入口（grid.html）：纯展示，无编辑器
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InstanceShell title='Data Grid'>
      <DataGridPage />
    </InstanceShell>
  </React.StrictMode>,
);
