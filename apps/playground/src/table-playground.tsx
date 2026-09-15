import { DecisionTable } from '@republicroad/jdm-editor';
import React, { useState } from 'react';

import { initialTable } from './shared/fixtures';
import { InstanceShell } from './shared/instance-shell';

/** Decision Table 实例（MPA 入口 table.html）：业务模式表格编辑，夹具本地态不落存储 */
export const TablePlayground: React.FC = () => {
  const [table, setTable] = useState<any>(initialTable);

  return (
    <InstanceShell title='Decision Table'>
      <DecisionTable value={table} onChange={setTable} mode='business' tableHeight='100%' />
    </InstanceShell>
  );
};
