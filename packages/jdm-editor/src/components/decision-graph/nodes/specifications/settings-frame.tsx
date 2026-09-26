import { Frame, FrameHeader, FramePanel, FrameTitle } from '#reui/frame';
import React from 'react';

/**
 * 节点设置面板的统一壳（WS2 填缝 #4）：spec 的 renderSettings 内容统一由
 * Frame 承载——标题/描述/分区规范化。保留 `settings-form` 类：node-inspector
 * 与 decision-node 的父级选择器（[&_.settings-form_.seal-ce]）依赖它做字号级联。
 */
export const SettingsFrame: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <Frame className='settings-form w-full'>
    <FrameHeader>
      <FrameTitle>{title}</FrameTitle>
      {description ? <p className='text-muted-foreground text-xs'>{description}</p> : null}
    </FrameHeader>
    <FramePanel className='flex flex-col gap-3'>{children}</FramePanel>
  </Frame>
);
