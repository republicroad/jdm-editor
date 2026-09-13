import { Sortable } from '#components/reui/sortable';
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '#components/reui/timeline';
import React, { useState } from 'react';

const execSteps = [
  { title: 'Input Node', detail: 'Request received: customer.tier = GOLD', time: '0.0µs' },
  { title: 'Discount Table', detail: 'Rule r1 matched: GOLD → rate 0.85', time: '34.0µs' },
  { title: 'Output Node', detail: 'Response: discount.rate = 0.85', time: '2.0µs' },
];

const ruleItems = [
  { id: 's1', label: 'GOLD tier discount (0.85)' },
  { id: 's2', label: 'SILVER tier discount (0.60)' },
  { id: 's3', label: 'BRONZE tier discount (0.30)' },
];

type TreeNode = { id: string; name: string; children?: TreeNode[] };

const treeData: TreeNode = {
  id: 'root',
  name: 'Decision Model',
  children: [
    {
      id: 'input',
      name: 'Input: Request',
      children: [{ id: 'in-tier', name: 'customer.tier (string)' }],
    },
    {
      id: 'table',
      name: 'Decision Table: discount',
      children: [
        { id: 'r1', name: 'Rule r1: GOLD → 0.85' },
        { id: 'r2', name: 'Rule r2: fallback → 0.00' },
      ],
    },
    { id: 'output', name: 'Output: Response', children: [] },
  ],
};

function SimpleTree({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div>
      <button
        type='button'
        className='flex items-center gap-1.5 px-2 py-1 rounded text-[13px] hover:bg-accent w-full text-left cursor-pointer'
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren && <span className='text-[10px] opacity-50 w-3'>{open ? '▾' : '▸'}</span>}
        {!hasChildren && <span className='w-3' />}
        {node.name}
      </button>
      {open && hasChildren && node.children!.map((c) => <SimpleTree key={c.id} node={c} depth={depth + 1} />)}
    </div>
  );
}

export const ReUIShowcasePage: React.FC = () => {
  const [sortableItems, setSortableItems] = useState(ruleItems);

  return (
    <div style={{ padding: '24px 16px', maxWidth: 900, margin: '0 auto', display: 'grid', gap: 24 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>reui 组件演示</h2>

      <section className='v-card' style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Timeline（执行步骤）</h3>
        <Timeline>
          {execSteps.map((step, i) => (
            <TimelineItem key={i} step={i + 1}>
              <TimelineHeader>
                <TimelineTitle>{step.title}</TimelineTitle>
              </TimelineHeader>
              <TimelineIndicator />
              <TimelineSeparator />
              <TimelineContent>
                {step.detail}
                <span style={{ opacity: 0.4, marginLeft: 8 }}>{step.time}</span>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </section>

      <section className='v-card' style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Sortable（拖拽排序列表）</h3>
        <Sortable
          value={sortableItems}
          onValueChange={setSortableItems}
          getItemValue={(item: { id: string }) => item.id}
          renderItem={(item: { id: string; label: string }) => (
            <div
              key={item.id}
              className='flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--border)] bg-card text-[13px] cursor-grab active:cursor-grabbing'
            >
              <span className='opacity-40'>⠿</span>
              {item.label}
            </div>
          )}
        />
      </section>

      <section className='v-card' style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Tree（决策模型层级）</h3>
        <SimpleTree node={treeData} />
      </section>
    </div>
  );
};
