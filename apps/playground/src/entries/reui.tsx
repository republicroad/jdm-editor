import React from 'react';
import { createRoot } from 'react-dom/client';

import '../playground.css';
import { ReUIShowcasePage } from '../reui-showcase';
import { InstanceShell } from '../shared/instance-shell';
import { usePersistedGraph } from '../shared/use-persisted-graph';
import '../theme.css';

// ReUI Showcase 实例入口（reui.html）：live 树取共享 IndexedDB 的已保存图
const ReUIEntry: React.FC = () => {
  const graph = usePersistedGraph();
  return (
    <InstanceShell title='ReUI Showcase'>
      <ReUIShowcasePage graph={graph as { nodes: any[]; edges: any[] }} />
    </InstanceShell>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReUIEntry />
  </React.StrictMode>,
);
