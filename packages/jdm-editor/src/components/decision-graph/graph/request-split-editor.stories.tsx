import { type Meta, type StoryObj } from '@storybook/react-vite';
import React, { useMemo, useState } from 'react';
import { expect, fireEvent, waitFor, within } from 'storybook/test';

import '../../../helpers/monaco';
import type { RequestDefinition, RequestDefinitionType } from '../../../helpers/request-schema';
import { SplitEditor } from './request-split-editor';

const meta: Meta<typeof SplitEditor> = {
  title: 'Decision Graph/Input Node/SplitEditor',
  component: SplitEditor,
};

export default meta;

type Story = StoryObj<typeof SplitEditor>;

const definition = (overrides: Partial<RequestDefinition> & { id: string }): RequestDefinition => ({
  path: overrides.id,
  name: overrides.id,
  type: 'string',
  description: '',
  format: '',
  order: 0,
  depth: 0,
  parentPath: null,
  source: 'schema.properties',
  ...overrides,
});

const baseDefinitions = (): RequestDefinition[] => [
  definition({ id: 'customer', path: 'customer', name: 'customer', type: 'string', description: 'Customer tier' }),
  definition({
    id: 'cart',
    path: 'cart',
    name: 'cart',
    type: 'object',
    description: '',
    parentPath: null,
  }),
  definition({
    id: 'cart.weight',
    path: 'cart.weight',
    name: 'weight',
    type: 'number',
    parentPath: 'cart',
    depth: 1,
  }),
  definition({
    id: 'cart.items',
    path: 'cart.items',
    name: 'items',
    type: 'array',
    parentPath: 'cart',
    depth: 1,
  }),
];

/** 本地可变定义稿的容器：mutator 语义与 use-request-definitions-editing 对齐（仅名称/类型可变部分在此演示） */
const SplitEditorHarness: React.FC<{
  initialSelected?: string | null;
  drift?: boolean;
}> = ({ initialSelected = 'customer', drift = false }) => {
  const [definitions, setDefinitions] = useState(baseDefinitions());
  const [selectedPath, setSelectedPath] = useState<string | null>(initialSelected);
  const [jsonDraft, setJsonDraft] = useState('{\n  "customer": "GOLD",\n  "cart": { "weight": 3 }\n}');

  const childrenMap = useMemo(() => {
    const map = new Map<string, RequestDefinition[]>();
    definitions.forEach((item) => {
      if (!item.parentPath) {
        return;
      }
      const current = map.get(item.parentPath) ?? [];
      current.push(item);
      map.set(item.parentPath, current);
    });
    return map;
  }, [definitions]);

  const rootDefinitions = useMemo(() => definitions.filter((item) => !item.parentPath), [definitions]);

  const mutate = (index: number, patch: Partial<RequestDefinition>) => {
    setDefinitions((previous) => previous.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const definitionTypeOptions = (['string', 'number', 'boolean', 'object', 'array', 'datetime'] as const).map(
    (value) => ({ value: value as RequestDefinitionType, label: value }),
  );

  return (
    <div style={{ height: 640, display: 'flex', flexDirection: 'column' }} data-testid='split-editor-harness'>
      <SplitEditor
        disabled={false}
        rootDefinitions={rootDefinitions}
        childrenMap={childrenMap}
        definitionTypeOptions={definitionTypeOptions}
        selectedPath={selectedPath}
        onSelectField={setSelectedPath}
        onAddField={() =>
          setDefinitions((previous) => [
            ...previous,
            definition({
              id: `field-${previous.length + 1}`,
              path: `field${previous.length + 1}`,
              name: `field${previous.length + 1}`,
            }),
          ])
        }
        onAddChild={(index) => {
          const parent = definitions[index];
          setDefinitions((previous) => [
            ...previous,
            definition({
              id: `${parent.path}.child`,
              path: `${parent.path}.child`,
              name: 'child',
              type: 'string',
              parentPath: parent.path,
              depth: parent.depth + 1,
            }),
          ]);
        }}
        onUpdateName={(index, name) => mutate(index, { name, path: name })}
        onUpdateType={(index, type) => mutate(index, { type })}
        onUpdateDefaultValue={(index, value) => mutate(index, { defaultValue: value || undefined })}
        onUpdateDescription={(index, value) => mutate(index, { description: value })}
        onRemoveField={(index) => setDefinitions((previous) => previous.filter((_, i) => i !== index))}
        getDefinitionIndex={(id) => definitions.findIndex((item) => item.id === id)}
        exampleSources={[{ id: 'ex-1', name: '正常GOLD用户', data: {}, source: 'schema.examples' }]}
        activeExampleIndex={0}
        activeExampleJsonDraft={jsonDraft}
        activeDescriptionDraft='gold tier example'
        exampleFieldSummary={null}
        driftStates={
          drift
            ? {
                'ex-1': {
                  drift: {
                    missing: [],
                    extra: ['bonus'],
                    conflicts: [{ path: 'cart.weight', nextType: 'number', value: '3' }],
                  },
                  schemaChanged: true,
                  constraintIssues: [],
                },
              }
            : undefined
        }
        onDescriptionChange={() => undefined}
        onDescriptionCommit={() => undefined}
        onExampleJsonChange={(value) => setJsonDraft(value)}
        onExampleJsonCommit={() => undefined}
        onFormatExample={() => undefined}
        onExampleJsonEditorMount={() => undefined}
        onMigrateActive={() => undefined}
        onConfirmActive={() => undefined}
        getDefinitionTypeLabel={(type) => type}
        exampleEditorOptions={{} as never}
        onRenameActive={(nextName) => {
          setDefinitions((previous) =>
            previous.map((item, index) => (index === 0 ? { ...item, name: nextName, path: nextName } : item)),
          );
        }}
      />
    </div>
  );
};

export const Populated: Story = {
  render: () => <SplitEditorHarness />,
  play: async ({ canvasElement }) => {
    // 字段树常驻：三级字段全部可见（结构导航，不随选中变化）
    await waitFor(() => {
      expect(canvasElement.querySelector("[data-path='customer']")).not.toBeNull();
      expect(canvasElement.querySelector("[data-path='cart']")).not.toBeNull();
      expect(canvasElement.querySelector("[data-path='cart.weight']")).not.toBeNull();
    });

    // 点击树节点 → 上下文编辑器跟随
    await fireEvent.click(canvasElement.querySelector("[data-path='cart']")!);
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="context-editor-path"]')?.textContent).toBe('cart');
    });

    await fireEvent.click(canvasElement.querySelector("[data-path='cart.weight']")!);
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="context-editor-path"]')?.textContent).toBe('cart.weight');
    });

    // Preview 条随活动示例呈现
    expect(canvasElement.querySelector('[data-testid="example-preview-strip"]')).not.toBeNull();
  },
};

export const ObjectFieldChildren: Story = {
  render: () => <SplitEditorHarness initialSelected='cart' />,
  play: async ({ canvasElement }) => {
    // object 类型 → 子字段列表 + 添加子字段（OQ1/OQ2 答案的实施证据）
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="object-children"]')).not.toBeNull();
    });
    expect(canvasElement.textContent).toContain('weight');
  },
};

export const NoFields: Story = {
  render: () => {
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    return (
      <div style={{ height: 640 }}>
        <SplitEditor
          disabled={false}
          rootDefinitions={[]}
          childrenMap={new Map()}
          definitionTypeOptions={[]}
          selectedPath={selectedPath}
          onSelectField={setSelectedPath}
          onAddField={() => undefined}
          onAddChild={() => undefined}
          onUpdateName={() => undefined}
          onUpdateType={() => undefined}
          onUpdateDefaultValue={() => undefined}
          onUpdateDescription={() => undefined}
          onRemoveField={() => undefined}
          getDefinitionIndex={() => -1}
          exampleSources={[]}
          activeExampleIndex={0}
          activeExampleJsonDraft=''
          activeDescriptionDraft=''
          exampleFieldSummary={null}
          onDescriptionChange={() => undefined}
          onDescriptionCommit={() => undefined}
          onExampleJsonChange={() => undefined}
          onExampleJsonCommit={() => undefined}
          onFormatExample={() => undefined}
          onExampleJsonEditorMount={() => undefined}
          onMigrateActive={() => undefined}
          onConfirmActive={() => undefined}
          getDefinitionTypeLabel={(type) => type}
          exampleEditorOptions={{} as never}
          onRenameActive={() => undefined}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('No field definitions')).not.toBeNull();
    expect(canvas.getByText('Select a field in the tree to edit it')).not.toBeNull();
  },
};

export const DriftedExample: Story = {
  render: () => <SplitEditorHarness drift />,
  play: async ({ canvasElement }) => {
    // 漂移计数 + 迁移动作内联在 Preview 条（创作时 quality gate 落在编辑现场）
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="example-preview-strip"]')?.textContent).toContain('Migrate');
    });
  },
};
