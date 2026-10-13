import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import { fn } from 'storybook/test';

import { type FunctionScope, computeInstanceSchedule } from '../../../helpers/custom-function-schema';
import { type FunctionInstance, InstanceEditor } from './instance-editor';

/**
 * 实例依赖编辑面 demo（ADR-015 增补 UI 面）：
 * - roster_view：声明 + args 引用 → 干净依赖（分层徽标 L2）
 * - count_only：声明未引用 → info 提示（纯排序合法）
 * - broken：悬空 dependsOn（ghost）→ 红显 + "调度将忽略"警示
 * - 引用源面板：$.roster_admin 及仿真输出一级字段，点击复制贴进 args 建隐式边
 */

const functionScope: FunctionScope = {
  mode: 'scoped',
  functions: [
    {
      name: 'roster',
      description: 'Roster lookup — returns dept members of the given department.',
      parameters: {
        type: 'object',
        properties: {
          dept: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['dept'],
      },
    },
  ],
};

const instancesDefault: FunctionInstance[] = [
  { id: 'i1', key: 'roster_admin', call: { $call: 'roster', kwargs: { dept: "'ops'" } } },
  {
    id: 'i2',
    key: 'roster_view',
    call: { $call: 'roster', kwargs: { dept: '$.roster_admin.dept', limit: 10 } },
    dependsOn: ['roster_admin'],
  },
  {
    id: 'i3',
    key: 'count_only',
    call: { $call: 'roster', kwargs: { dept: "'sec'" } },
    dependsOn: ['roster_admin'],
  },
  {
    id: 'i4',
    key: 'broken',
    call: { $call: 'roster', kwargs: { dept: "'x'" } },
    dependsOn: ['ghost'],
  },
];

const outputsByKey: Record<string, unknown> = {
  roster_admin: { dept: 'ops', members: ['alice', 'bob'] },
};

/** tab-custom-function-table 同款写形态（实例 → 规范形行，dependsOn 透传） */
const toExpressionShape = (insts: FunctionInstance[]) =>
  insts.map((inst) => ({
    id: inst.id,
    key: inst.key,
    type: 'function',
    value: inst.call,
    ...(inst.dependsOn ? { dependsOn: inst.dependsOn } : {}),
  }));

const meta: Meta<typeof InstanceEditor> = {
  title: 'Instance Editor',
  component: InstanceEditor,
  args: {
    disabled: false,
    onChange: fn(),
  },
  argTypes: {
    functionScope: { table: { disable: true } },
    schedule: { table: { disable: true }, control: false },
  },
};

export default meta;

type Story = StoryObj<typeof InstanceEditor>;

export const DependencyEditing: Story = {
  render: (args) => {
    const [instances, setInstances] = useState<FunctionInstance[]>(instancesDefault);
    const schedule = computeInstanceSchedule(toExpressionShape(instances));

    return (
      <div style={{ height: 560 }}>
        <InstanceEditor
          {...args}
          instances={instances}
          functionScope={functionScope}
          outputsByKey={outputsByKey}
          schedule={schedule}
          onChange={(next) => {
            setInstances(next);
            args?.onChange?.(next);
          }}
        />
      </div>
    );
  },
};
