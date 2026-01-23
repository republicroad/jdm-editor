# 快速开始：添加新节点

## ✅ 已完成的工作

### 1. HTTP请求节点
已成功添加HTTP请求节点，功能包括：
- ✅ 支持多种HTTP方法（GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS）
- ✅ Postman风格的UI界面
- ✅ 查询参数管理
- ✅ 请求头管理
- ✅ 多种认证方式（Bearer Token, Basic Auth, API Key）
- ✅ 请求体支持（JSON, Raw, Form Data, URL-encoded）
- ✅ 超时和重定向设置

### 2. 自动化工具
- ✅ `create-node.mjs` - 节点模板生成器（ES模块兼容）
- ✅ `node-registry.ts` - 集中式节点注册系统
- ✅ `NODE_GUIDE.md` - 完整的节点添加指南

## 🚀 如何添加新节点

### 方法一：使用自动生成器（推荐）

```bash
# 进入specifications目录
cd ./jdm-editor/packages/jdm-editor/src/components/decision-graph/nodes/specifications

# 生成新节点（示例：数据库查询节��）
node create-node.mjs database-query --editable --group="Database"

# 参数说明：
# database-query: 节点名称（kebab-case格式）
# --editable: 节点在列表视图中可编辑（可选）
# --group="Database": 节点分组名称（可选）
```

生成后会创建：
- `database-query.specification.tsx` - 节点规范定义
- `../../graph/tab-database-query.tsx` - 节点编辑器组件
- `database-query.registration.txt` - 注册步骤说明

### 方法二：手动添加

查看 [NODE_GUIDE.md](./NODE_GUIDE.md) 获取详细的手动添加步骤。

## 📋 注册新节点的步骤

生成文件后，需要在以下位置注册节点：

### 1. 添加枚举类型
在 [specification-types.ts](./specification-types.ts) 中：
```typescript
export enum NodeKind {
  // ... 其他节点
  DatabaseQuery = 'databaseQueryNode',  // 👈 添加这一行
}
```

### 2. 注册节点规范
在 [specifications.tsx](./specifications.tsx) 中：
```typescript
import { databaseQuerySpecification } from './database-query.specification';

export const nodeSpecification = makeNodeSpecification({
  // ... 其他节点
  [NodeKind.DatabaseQuery]: databaseQuerySpecification,  // 👈 添加这一行
});
```

### 3. 注册Tab渲染
在 [dg-wrapper.tsx](../../dg-wrapper.tsx) 的 TabContents 组件中：
```typescript
import { databaseQuerySpecification } from './nodes/specifications/database-query.specification';

// 在match语句中添加
.with(NodeKind.DatabaseQuery, () => databaseQuerySpecification?.renderTab?.({ id: node?.id, manager: dndManager }))
```

### 4. 标记为可编辑（可选）
在 [graph-nodes.tsx](../../graph/graph-nodes.tsx) 中：
```typescript
disabled: match(kind)
  .with(NodeKind.Function, () => false)
  .with(NodeKind.DecisionTable, () => false)
  .with(NodeKind.Expression, () => false)
  .with(NodeKind.HttpRequest, () => false)
  .with(NodeKind.DatabaseQuery, () => false)  // 👈 添加这一行
  .otherwise(() => true),
```

### 5. 添加节点分组（可选）
在 [graph-nodes.tsx](../../graph/graph-nodes.tsx) 中：
```typescript
const nodeGroups = useMemo(() => {
  return [
    // ... 其他分组
    {
      title: 'Database',
      nodes: filtered.filter((node) => node.type === NodeKind.DatabaseQuery),
    },
  ];
}, [search, nodes]);
```

### 6. 构建测试
```bash
npm run build
```

## 📚 参考资源

- [NODE_GUIDE.md](./NODE_GUIDE.md) - 完整的节点添加指南
- [node-registry.ts](./node-registry.ts) - 节点注册系统API
- [http-request.specification.tsx](./http-request.specification.tsx) - HTTP请求节点示例

## 💡 提示

1. **命名规范**：
   - 文件名：kebab-case（如 `database-query.specification.tsx`）
   - 类型名：PascalCase（如 `NodeDatabaseQueryData`）
   - 变量名：camelCase（如 `databaseQuerySpecification`）

2. **常见问题**：
   - 如果节点拖到画布后不显示 → 检查是否在 `specifications.tsx` 中注册
   - 如果点击编辑显示空白页 → 检查是否在 `dg-wrapper.tsx` 中添加Tab渲染
   - 如果节点在列表中不可点击 → 检查是否在 `graph-nodes.tsx` 中标记为可编辑

3. **最佳实践**：
   - 使用TypeScript定义清晰的数据结构
   - 为表单字段添加disabled状态支持
   - 选择合适的图标和颜色
   - 添加有意义的描述和文档链接

## 🎉 完成！

现在你可以快速添加新的节点类型了。如有问题，请查看 [NODE_GUIDE.md](./NODE_GUIDE.md) 或参考现有节点的实现。
