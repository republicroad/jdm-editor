import { ThemeContextProvider } from '@republicroad/jdm-appshell';
import React from 'react';

import { ThemeToggle } from './shared/instance-shell';

type InstanceCard = { href: string; icon: string; title: string; description: string };

const instances: InstanceCard[] = [
  {
    href: './graph.html',
    icon: '🕸️',
    title: 'Decision Graph',
    description:
      '决策图编辑器：节点编排、模拟执行、版本历史（IndexedDB）与 diff 对比，可联动 demo-server 执行；含 ocean 皮肤槽位演示。',
  },
  {
    href: './table.html',
    icon: '▦',
    title: 'Decision Table',
    description: '决策表业务模式：行列编辑、表达式单元格与命中策略（hit policy）。',
  },
  {
    href: './grid.html',
    icon: '⌗',
    title: 'Data Grid',
    description: 'ReUI DataGrid 展示：排序、全局过滤与列徽标渲染。',
  },
  {
    href: './reui.html',
    icon: '✦',
    title: 'ReUI Showcase',
    description: 'ReUI 组件巡礼：Timeline 执行轨迹、Sortable 规则池与决策模型层级树（读取 graph 实例的已保存图）。',
  },
  {
    href: './trust.html',
    icon: '🔗',
    title: 'Trust Chain',
    description: '信任链演示：执行 + 审计事件 → 确定性回放 → 影子对比（需 demo-server :8787）。',
  },
  {
    href: './udf.html',
    icon: '🧩',
    title: 'Custom Nodes',
    description:
      '节点工作台：自定义节点编排（schema 端点驱动面板）→ simulator 全链路仿真 → Trust Chain 三步（EditorShell 接入样例）。',
  },
  {
    href: './flow.html',
    icon: '🔀',
    title: 'Flow Pilot',
    description:
      'ReUI flow-1 块试点：自动化工作流画布（xyflow v12 + ReUI 组件），评估 kernel/appshell 的 ReUI 迁移姿势。',
  },
];

/** 目录页（MPA 入口 index.html）：playground 各独立实例的导航 */
export const DirectoryPage: React.FC = () => (
  <ThemeContextProvider>
    <div className='pg-root'>
      <header className='pg-header'>
        <strong>JDM Playground</strong>
        <span className='pg-subtitle'>jdm-editor / jdm-appshell 实例目录 —— 每个卡片是独立页面（Vite MPA）</span>
        <div className='pg-actions'>
          <ThemeToggle />
        </div>
      </header>
      <main className='pg-directory'>
        {instances.map((it) => (
          <a key={it.href} className='pg-card' href={it.href}>
            <span className='pg-card-icon'>{it.icon}</span>
            <span className='pg-card-title'>{it.title}</span>
            <span className='pg-card-desc'>{it.description}</span>
            <span className='pg-card-go'>打开 →</span>
          </a>
        ))}
      </main>
    </div>
  </ThemeContextProvider>
);
