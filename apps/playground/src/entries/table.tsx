import React from 'react';
import { createRoot } from 'react-dom/client';

import '../playground.css';
import { setupMonaco } from '../shared/monaco-setup';
import { TablePlayground } from '../table-playground';
import '../theme.css';

setupMonaco();

// Decision Table 实例入口（table.html）
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TablePlayground />
  </React.StrictMode>,
);
