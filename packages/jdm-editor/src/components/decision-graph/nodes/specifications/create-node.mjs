#!/usr/bin/env node

/**
 * 节点模板生成器
 *
 * 使用方法:
 * node create-node.mjs <节点名称> [选项]
 *
 * 示例:
 * node create-node.mjs database-query --editable --group="Database"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 解析命令行参数
const args = process.argv.slice(2);
const nodeName = args[0];

if (!nodeName) {
  console.error('错误: 请提供节点名称');
  console.log('使用方法: node create-node.mjs <节点名称> [选项]');
  process.exit(1);
}

// 解析选项
const options = {
  editable: args.includes('--editable'),
  group: args.find(arg => arg.startsWith('--group='))?.split('=')[1] || null,
};

// 转换命名格式
const pascalCase = nodeName
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join('');

const camelCase = nodeName
  .split('-')
  .map((word, index) =>
    index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
  )
  .join('');

const enumName = nodeName
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join('');

const nodeType = `${camelCase}Node`;

// 生成specification文件内容
const specificationContent = `import { Button } from 'antd';
import React from 'react';

import { useDecisionGraphActions } from '../../context/dg-store.context';
import { Tab${pascalCase} } from '../../graph/tab-${nodeName}';
import { GraphNode } from '../graph-node';
import { NodeColor } from './colors';
import type { NodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';

/**
 * ${pascalCase}节点数据结构
 */
export type Node${pascalCase}Data = {
  // TODO: 定义你的节点数据结构
  config?: any;
};

/**
 * ${pascalCase}节点规范定义
 */
export const ${camelCase}Specification: NodeSpecification<Node${pascalCase}Data> = {
  type: NodeKind.${enumName},
  icon: <span>📦</span>, // TODO: 替换为合适的图标
  displayName: '${pascalCase}',
  documentationUrl: 'https://your-docs-url.com', // TODO: 添加文档链接
  shortDescription: '${pascalCase} node', // TODO: 添加简短描述
  color: NodeColor.Blue, // TODO: 选择合适的颜色
  renderTab: ({ id }) => <Tab${pascalCase} id={id} />,
  generateNode: ({ index }) => ({
    name: \`${camelCase}\${index}\`,
    content: {
      // TODO: 定义默认内容
      config: {},
    },
  }),
  renderNode: ({ id, data, selected, specification }) => {
    const graphActions = useDecisionGraphActions();
    return (
      <GraphNode
        id={id}
        specification={specification}
        name={data.name}
        isSelected={selected}
        actions={[
          <Button key='edit-${nodeName}' type='text' onClick={() => graphActions.openTab(id)}>
            Edit ${pascalCase}
          </Button>,
        ]}
      />
    );
  },
};
`;

// 生成Tab组件内容
const tabContent = `import { Button, Form, Input } from 'antd';
import React from 'react';

import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import type { Node${pascalCase}Data } from '../nodes/specifications/${nodeName}.specification';

export type Tab${pascalCase}Props = {
  id: string;
};

/**
 * ${pascalCase}编辑器组件
 */
export const Tab${pascalCase}: React.FC<Tab${pascalCase}Props> = ({ id }) => {
  const graphActions = useDecisionGraphActions();
  const { disabled, content } = useDecisionGraphState(({ disabled, decisionGraph }) => ({
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as Node${pascalCase}Data,
  }));

  // 更新节点内容的辅助函数
  const updateContent = (updates: Partial<Node${pascalCase}Data>) => {
    graphActions.updateNode(id, (draft) => {
      Object.assign(draft.content, updates);
      return draft;
    });
  };

  return (
    <div style={{ height: '100%', padding: 16 }}>
      <Form layout="vertical">
        {/* TODO: 添加你的表单字段 */}
        <Form.Item label="配置">
          <Input
            disabled={disabled}
            placeholder="输入配置"
            value={content?.config || ''}
            onChange={(e) => updateContent({ config: e.target.value })}
          />
        </Form.Item>
      </Form>
    </div>
  );
};
`;

// 生成注册代码片段
const registrationSnippet = `
# 节点注册步骤

## 1. 在 specification-types.ts 中添加枚举:

export enum NodeKind {
  // ... 其他节点
  ${enumName} = '${nodeType}',  // 👈 添加这一行
}

## 2. 在 specifications.tsx 中注册:

// 导入
import { ${camelCase}Specification } from './${nodeName}.specification';

// 在 nodeSpecification 对象中添加
export const nodeSpecification = makeNodeSpecification({
  // ... 其他节点
  [NodeKind.${enumName}]: ${camelCase}Specification,  // 👈 添加这一行
});

## 3. 在 dg-wrapper.tsx 的 TabContents 组件中添加:

// 导入
import { ${camelCase}Specification } from './nodes/specifications/${nodeName}.specification';

// 在 match 语句中添加
.with(NodeKind.${enumName}, () => ${camelCase}Specification?.renderTab?.({ id: node?.id, manager: dndManager }))

${options.editable ? `
## 4. （可选）在 graph-nodes.tsx 中标记为可编辑:

disabled: match(kind)
  .with(NodeKind.Function, () => false)
  .with(NodeKind.DecisionTable, () => false)
  .with(NodeKind.Expression, () => false)
  .with(NodeKind.HttpRequest, () => false)
  .with(NodeKind.${enumName}, () => false)  // 👈 添加这一行
  .otherwise(() => true),

## 5. （可选）在 graph-nodes.tsx 中添加分组:

const nodeGroups = useMemo(() => {
  return [
    // ... 其他分组
    {
      title: '${options.group || pascalCase + 's'}',
      nodes: filtered.filter((node) => node.type === NodeKind.${enumName}),
    },
  ];
}, [search, nodes]);
` : ''}

## 完成后运行:
npm run build
`;

// 创建文件
const specPath = path.join(__dirname, `${nodeName}.specification.tsx`);
const tabPath = path.join(__dirname, '../../graph', `tab-${nodeName}.tsx`);
const snippetPath = path.join(__dirname, `${nodeName}.registration.txt`);

try {
  fs.writeFileSync(specPath, specificationContent);
  console.log(`✅ 创建 specification 文件: ${specPath}`);

  fs.writeFileSync(tabPath, tabContent);
  console.log(`✅ 创建 Tab 组件文件: ${tabPath}`);

  fs.writeFileSync(snippetPath, registrationSnippet);
  console.log(`✅ 创建注册代码片段: ${snippetPath}`);

  console.log('\n📝 下一步:');
  console.log('1. 查看生成的文件并根据需要修改');
  console.log(`2. 按照 ${nodeName}.registration.txt 中的说明注册节点`);
  console.log('3. 运行 npm run build 测试');
} catch (error) {
  console.error('❌ 创建文件失败:', error.message);
  process.exit(1);
}
