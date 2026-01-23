# 节点添加指南

本指南将帮助你快速添加新的节点类型到JDM编辑器中。

## 📋 目录

1. [快速开始](#快速开始)
2. [手动添加流程](#手动添加流程)
3. [节点结构说明](#节点结构说明)
4. [常见问题](#常见问题)

---

## 🚀 快速开始

### 方法一：使用自动生成工具（推荐）

```bash
# 进入specifications目录
cd ./jdm-editor/packages/jdm-editor/src/components/decision-graph/nodes/specifications

# 生成新节点
node create-node.js database-query --editable --group="Database"

# 参数说明:
# database-query: 节点名称（使用kebab-case）
# --editable: 节点在列表视图中可编辑（可选）
# --group="Database": 节点分组名称（可选）
```

生成后会创建以下文件：
- `database-query.specification.tsx` - 节点规范定义
- `../../graph/tab-database-query.tsx` - 节点编辑器组件
- `database-query.registration.txt` - 注册代码片段

### 方法二：复制现有节点模板

```bash
# 复制HTTP请求节点作为模板
cp http-request.specification.tsx your-node.specification.tsx
cp ../../graph/tab-http-request.tsx ../../graph/tab-your-node.tsx

# 然后修改文件内容
```

---

## 📝 手动添加流程

如果你想完全手动添加节点，请按照以下步骤：

### 步骤1: 添加节点类型枚举

在 `specification-types.ts` 中添加新的节点类型：

```typescript
export enum NodeKind {
  Input = 'inputNode',
  Output = 'outputNode',
  // ... 其他节点
  YourNode = 'yourNode',  // 👈 添加这一行
}
```

### 步骤2: 创建节点规范文件

创建 `your-node.specification.tsx`：

```typescript
import { Button } from 'antd';
import React from 'react';

import { useDecisionGraphActions } from '../../context/dg-store.context';
import { TabYourNode } from '../../graph/tab-your-node';
import { GraphNode } from '../graph-node';
import { NodeColor } from './colors';
import type { NodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';

// 1. 定义节点数据结构
export type NodeYourNodeData = {
  config: string;
  // 添加你需要的字段
};

// 2. 创建节点规范
export const yourNodeSpecification: NodeSpecification<NodeYourNodeData> = {
  type: NodeKind.YourNode,
  icon: <span>🎯</span>,
  displayName: '你的节点',
  shortDescription: '节点描述',
  color: NodeColor.Blue,

  // 3. 定义Tab渲染器
  renderTab: ({ id }) => <TabYourNode id={id} />,

  // 4. 定义节点生成器
  generateNode: ({ index }) => ({
    name: `yourNode${index}`,
    content: {
      config: '',
    },
  }),

  // 5. 定义节点渲染器
  renderNode: ({ id, data, selected, specification }) => {
    const graphActions = useDecisionGraphActions();
    return (
      <GraphNode
        id={id}
        specification={specification}
        name={data.name}
        isSelected={selected}
        actions={[
          <Button key='edit' type='text' onClick={() => graphActions.openTab(id)}>
            编辑
          </Button>,
        ]}
      />
    );
  },
};
```

### 步骤3: 创建Tab编辑器组件

创建 `graph/tab-your-node.tsx`：

```typescript
import { Form, Input } from 'antd';
import React from 'react';

import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import type { NodeYourNodeData } from '../nodes/specifications/your-node.specification';

export type TabYourNodeProps = {
  id: string;
};

export const TabYourNode: React.FC<TabYourNodeProps> = ({ id }) => {
  const graphActions = useDecisionGraphActions();
  const { disabled, content } = useDecisionGraphState(({ disabled, decisionGraph }) => ({
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeYourNodeData,
  }));

  const updateContent = (updates: Partial<NodeYourNodeData>) => {
    graphActions.updateNode(id, (draft) => {
      Object.assign(draft.content, updates);
      return draft;
    });
  };

  return (
    <div style={{ height: '100%', padding: 16 }}>
      <Form layout="vertical">
        <Form.Item label="配置">
          <Input
            disabled={disabled}
            value={content?.config || ''}
            onChange={(e) => updateContent({ config: e.target.value })}
          />
        </Form.Item>
      </Form>
    </div>
  );
};
```

### 步骤4: 注册节点

#### 4.1 在 `specifications.tsx` 中注册

```typescript
import { yourNodeSpecification } from './your-node.specification';

export const nodeSpecification = makeNodeSpecification({
  // ... 其他节点
  [NodeKind.YourNode]: yourNodeSpecification,  // 👈 添加这一行
});
```

#### 4.2 在 `dg-wrapper.tsx` 中添加Tab渲染

```typescript
// 导入
import { yourNodeSpecification } from './nodes/specifications/your-node.specification';

// 在TabContents组件的match语句中添加
.with(NodeKind.YourNode, () => yourNodeSpecification?.renderTab?.({ id: node?.id, manager: dndManager }))
```

### 步骤5: （可选）使节点可编辑

如果你希望节点在列表视图中可编辑：

#### 5.1 在 `graph-nodes.tsx` 中标记为可编辑

```typescript
disabled: match(kind)
  .with(NodeKind.Function, () => false)
  .with(NodeKind.DecisionTable, () => false)
  .with(NodeKind.Expression, () => false)
  .with(NodeKind.HttpRequest, () => false)
  .with(NodeKind.YourNode, () => false)  // 👈 添加这一行
  .otherwise(() => true),
```

#### 5.2 添加节点分组

```typescript
const nodeGroups = useMemo(() => {
  return [
    // ... 其他分组
    {
      title: '你的节点分组',
      nodes: filtered.filter((node) => node.type === NodeKind.YourNode),
    },
  ];
}, [search, nodes]);
```

### 步骤6: 构建和测试

```bash
npm run build
```

---

## 🏗️ 节点结构说明

### 节点规范 (NodeSpecification)

```typescript
{
  type: string;              // 节点类型标识符
  icon: ReactNode;           // 节点图标
  displayName: string;       // 显示名称
  shortDescription: string;  // 简短描述
  color: string;             // 节点颜色
  documentationUrl?: string; // 文档链接

  // 生成新节点实例
  generateNode: (params: { index: number }) => Partial<DecisionNode>;

  // 渲染节点在画布上的外观
  renderNode: React.FC<MinimalNodeProps>;

  // 渲染节点编辑器Tab
  renderTab?: (props: { id: string; manager?: DragDropManager }) => ReactNode;

  // 渲染节点设置面板（可选）
  renderSettings?: React.FC<{ id: string }>;
}
```

### 节点数据结构

每个节点都有以下基本结构：

```typescript
{
  id: string;           // 唯一标识符
  type: string;         // 节点类型（对应NodeKind）
  name: string;         // 节点名称
  position: XYPosition; // 画布位置
  content: T;           // 节点内容（自定义数据）
}
```

---

## 🎨 可用的节点颜色

```typescript
NodeColor.Blue    // 蓝色
NodeColor.Purple  // 紫色
NodeColor.Orange  // 橙色
NodeColor.Green   // 绿色
```

---

## 💡 最佳实践

### 1. 命名规范

- **文件名**: 使用kebab-case，如 `http-request.specification.tsx`
- **类型名**: 使用PascalCase，如 `NodeHttpRequestData`
- **变量名**: 使用camelCase，如 `httpRequestSpecification`
- **枚举值**: 使用PascalCase，如 `NodeKind.HttpRequest`

### 2. 数据结构设计

```typescript
// ✅ 好的设计
export type NodeYourNodeData = {
  url: string;
  method: 'GET' | 'POST';
  headers: Array<{ key: string; value: string }>;
};

// ❌ 避免
export type NodeYourNodeData = {
  data: any;  // 太宽泛
};
```

### 3. 组件设计

```typescript
// ✅ 使用辅助函数更新内容
const updateContent = (updates: Partial<NodeYourNodeData>) => {
  graphActions.updateNode(id, (draft) => {
    Object.assign(draft.content, updates);
    return draft;
  });
};

// ✅ 使用disabled状态
<Input disabled={disabled} />
```

### 4. 图标选择

```typescript
// 使用Ant Design图标
import { SendOutlined } from '@ant-design/icons';
icon: <SendOutlined />

// 或使用Emoji
icon: <span>🚀</span>

// 或使用lucide-react图标
import { Database } from 'lucide-react';
icon: <Database size='1em' />
```

---

## ❓ 常见问题

### Q1: 节点拖到画布后不显示？

**A**: 检查以下几点：
1. 是否在 `specifications.tsx` 中注册了节点
2. `NodeKind` 枚举是否添加了对应值
3. `generateNode` 函数是否返回了正确的结构

### Q2: 点击编辑按钮后显示空白页？

**A**: 检查以下几点：
1. 是否在 `dg-wrapper.tsx` 中添加了 `.with()` case
2. Tab组件是否正确导入
3. Tab组件的 `id` prop是否正确传递

### Q3: 节点在列表视图中不可点击？

**A**: 在 `graph-nodes.tsx` 中将节点标记为可编辑：
```typescript
.with(NodeKind.YourNode, () => false)
```

### Q4: 如何添加自定义验证？

**A**: 在 `specification` 中添加 `onNodeAdd` 钩子：
```typescript
onNodeAdd: async (node) => {
  // 验证逻辑
  if (!node.content.url) {
    throw new Error('URL is required');
  }
  return node;
}
```

---

## 📚 参考示例

查看以下现有节点的实现作为参考：

1. **简单节点**: `expression.specification.tsx`
2. **复杂节点**: `http-request.specification.tsx`
3. **带设置面板**: `decision-table.specification.tsx`

---

## 🔄 完整示例：添加数据库查询节点

```bash
# 1. 生成模板
node create-node.js database-query --editable --group="Database"

# 2. 修改生成的文件
# - database-query.specification.tsx
# - tab-database-query.tsx

# 3. 按照 registration.txt 注册节点

# 4. 构建测试
npm run build
```

---

## 📞 需要帮助？

如果遇到问题，请：
1. 查看现有节点的实现
2. 检查控制台错误信息
3. 确保所有步骤都已完成

---

**祝你添加节点顺利！** 🎉
