import React from 'react';

import { GRAPH_ID, graphAdapter, initialGraph } from './fixtures';

/**
 * 从共享 IndexedDB 读取 head 图（graph 实例「Save」的产物），挂载后异步替换；
 * 无保存记录或读取失败时维持 initialGraph。trust（模型入参）与 reui（live 树）用。
 */
export const usePersistedGraph = (): unknown => {
  const [graph, setGraph] = React.useState<unknown>(initialGraph);
  React.useEffect(() => {
    let cancelled = false;
    graphAdapter
      .load(GRAPH_ID)
      .then((record) => {
        if (cancelled || !record?.content) return;
        setGraph({ ...(record.content as object), id: GRAPH_ID, revision: record.revision });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return graph;
};
