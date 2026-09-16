import React from 'react';

import { TrustChainPanel } from './shared/trust-chain-panel';

/** Trust Chain 实例页（MPA 入口 trust.html）：模型 = 共享 IndexedDB 的已保存图（graph 实例 Save 的产物） */
export const TrustChainPage: React.FC<{ model: unknown }> = ({ model }) => {
  return (
    <div style={{ padding: '16px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Trust Chain — 声明 → 强制 → 证据 → 重演</h2>
      <TrustChainPanel model={model} />
    </div>
  );
};
