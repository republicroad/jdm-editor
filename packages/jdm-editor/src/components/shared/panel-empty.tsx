import React from 'react';

/**
 * 面板空态的统一实现（WS2 填缝 #1）：request-definitions / request-examples
 * 等面板的"无数据"提示此前逐文件手写（gap/py/容器各异），统一到此。
 * action 为可选的引导按钮（如"新建数据源"）。
 */
export const PanelEmpty: React.FC<{
  message: string;
  action?: React.ReactNode;
}> = ({ message, action }) => (
  <div className='flex flex-col items-center gap-3 py-10 text-xs text-muted-foreground'>
    <span>{message}</span>
    {action}
  </div>
);
