import React from 'react';
import { createRoot } from 'react-dom/client';

import '../playground.css';
import { InstanceShell } from '../shared/instance-shell';
import { usePersistedGraph } from '../shared/use-persisted-graph';
import '../theme.css';
import { TrustChainPage } from '../trust-chain-page';

// Trust Chain 实例入口（trust.html）：被测模型取共享 IndexedDB 的已保存图
const TrustEntry: React.FC = () => {
  const graph = usePersistedGraph();
  return (
    <InstanceShell title='Trust Chain'>
      <TrustChainPage model={graph} />
    </InstanceShell>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrustEntry />
  </React.StrictMode>,
);
