# HTTP请求节点完整实现总结

## ✅ 已完成的工作

### 1. 数据格式对齐

HTTP请求节点的数据格式现在完全符合 `customNode` 规范：

```json
{
  "type": "httpRequestNode",
  "content": {
    "kind": "http",
    "config": {
      "version": "v3",
      "meta": { "user": "...", "proj": "..." },
      "expressions": [...],
      "expr_asts": [...],
      "passThrough": true,
      "inputField": null,
      "outputPath": null,
      "executionMode": "single",
      // HTTP特有字段
      "method": "POST",
      "url": "...",
      "headers": [...],
      "params": [...],
      "body": {...},
      "auth": {...},
      "timeout": 30000,
      "followRedirects": true
    }
  }
}
```

### 2. 自动数据转换

实现了自动将 HTTP 配置转换为 `expressions` 和 `expr_asts` 格式：

**Expressions 格式**:
```
http_call_with_headers;;url;;method;;body;;headers
```

**Expr_asts 格式**:
```json
["http_call_with_headers", "url", "method", "body", "headers"]
```

### 3. Meta 数据自动填充

每次更新节点配置时，自动更新 `meta` 信息：

```typescript
meta: {
  user: userId,     // 来自组件 props
  proj: projectId   // 来自组件 props
}
```

### 4. 实时同步

所有配置更改（method, url, headers, body）都会实时触发 expressions 和 expr_asts 的重新构建。

## 📁 相关文件

### 核心文件

1. **[http-request.specification.tsx](./http-request.specification.tsx)**
   - 节点类型定义
   - 数据结构定义（Expression, HttpRequestConfig, NodeHttpRequestData）
   - 节点生成逻辑

2. **[tab-http-request.tsx](../../graph/tab-http-request.tsx)**
   - Postman风格的UI编辑器
   - `buildExpressionsAndAsts()` 函数实现
   - 自动数据转换逻辑
   - Meta 数据填充

3. **[dg-wrapper.tsx](../../dg-wrapper.tsx)**
   - Tab 渲染逻辑
   - userId 和 projectId 传递

### 文档文件

1. **[HTTP_REQUEST_FORMAT.md](./HTTP_REQUEST_FORMAT.md)**
   - 数据格式详细说明
   - 字段说明
   - 迁移指南

2. **[HTTP_REQUEST_LOGIC.md](./HTTP_REQUEST_LOGIC.md)**
   - 数据逻辑实现细节
   - buildExpressionsAndAsts 函数说明
   - 完整示例

3. **[NODE_GUIDE.md](./NODE_GUIDE.md)**
   - 节点添加指南
   - 使用 create-node.mjs 工具

### 示例文件

1. **[http-request-example.json](./http-request-example.json)**
   - 基础示例

2. **[http-request-complete-example.json](/Users/zhangyulong/Downloads/http-request-complete-example.json)**
   - 完整示例（包含所有字段）

## 🔄 数据转换流程

```
用户输入 (UI)
    ↓
updateConfig()
    ↓
更新 config 字段
    ↓
更新 meta (userId, projectId)
    ↓
buildExpressionsAndAsts()
    ↓
生成 expressions (字符串格式，用 ;; 分隔)
    ↓
生成 expr_asts (数组格式)
    ↓
保存到节点
```

## 📊 数据对比

### graph (8).json 中的 customNode

```json
{
  "type": "customNode",
  "content": {
    "kind": "http",
    "config": {
      "version": "v3",
      "meta": {
        "user": "4205b0391bb64aa0925ac13c06ff24f3",
        "proj": "proj_fe43811be7d2460a"
      },
      "expressions": [
        {
          "id": "...",
          "key": "",
          "value": "http_call_with_headers;;http://127.0.0.1;;\"post\";;{'user':\"1223\"};;{'header':\"456\"}",
          "type": "function"
        }
      ],
      "expr_asts": [
        {
          "id": "...",
          "key": "",
          "value": [
            "http_call_with_headers",
            "http://127.0.0.1",
            "\"post\"",
            "{'user':\"1223\"}",
            "{'header':\"456\"}"
          ]
        }
      ],
      "passThrough": true,
      "inputField": null,
      "outputPath": null,
      "executionMode": "single"
    }
  }
}
```

### httpRequestNode (现在)

```json
{
  "type": "httpRequestNode",
  "content": {
    "kind": "http",
    "config": {
      "version": "v3",
      "meta": {
        "user": "4205b0391bb64aa0925ac13c06ff24f3",
        "proj": "proj_fe43811be7d2460a"
      },
      "expressions": [
        {
          "id": "...",
          "key": "",
          "value": "http_call_with_headers;;http://127.0.0.1/api/users;;\"post\";;{'user':'1223'};;{'Content-Type':'application/json'}",
          "type": "function"
        }
      ],
      "expr_asts": [
        {
          "id": "...",
          "key": "",
          "value": [
            "http_call_with_headers",
            "http://127.0.0.1/api/users",
            "\"post\"",
            "{'user':'1223'}",
            "{'Content-Type':'application/json'}"
          ]
        }
      ],
      "passThrough": true,
      "inputField": null,
      "outputPath": null,
      "executionMode": "single",
      "method": "POST",
      "url": "http://127.0.0.1/api/users",
      "headers": [
        {
          "id": "...",
          "key": "Content-Type",
          "value": "application/json",
          "enabled": true
        }
      ],
      "params": [],
      "body": {
        "type": "json",
        "content": "{\"user\": \"1223\"}"
      },
      "auth": {
        "type": "none"
      },
      "timeout": 30000,
      "followRedirects": true
    }
  }
}
```

## ✅ 格式一致性检查

| 字段 | customNode | httpRequestNode | 状态 |
|------|------------|-----------------|------|
| `kind` | `"http"` | `"http"` | ✅ 一致 |
| `version` | `"v3"` | `"v3"` | ✅ 一致 |
| `meta.user` | 动态值 | 动态值 | ✅ 一致 |
| `meta.proj` | 动态值 | 动态值 | ✅ 一致 |
| `expressions[0].type` | `"function"` | `"function"` | ✅ 一致 |
| `expressions[0].value` | `"http_call_with_headers;;..."` | `"http_call_with_headers;;..."` | ✅ 一致 |
| `expr_asts[0].value[0]` | `"http_call_with_headers"` | `"http_call_with_headers"` | ✅ 一致 |
| `expr_asts[0].value` | 数组格式 | 数组格式 | ✅ 一致 |
| `passThrough` | `true` | `true` | ✅ 一致 |
| `inputField` | `null` | `null` | ✅ 一致 |
| `outputPath` | `null` | `null` | ✅ 一致 |
| `executionMode` | `"single"` | `"single"` | ✅ 一致 |

## 🎯 关键实现细节

### 1. 参数顺序

**严格按照以下顺序**:
1. `http_call_with_headers` (固定)
2. URL
3. Method (小写，带引号)
4. Body (JSON对象，单引号)
5. Headers (JSON对象，单引号)

### 2. 引号处理

- Method: 使用双引号包裹，如 `"post"`
- Body/Headers: JSON格式，双引号转单引号，如 `{'key':'value'}`

### 3. Headers 过滤

只有 `enabled: true` 的 headers 会被包含在 expressions 中。

### 4. Body 类型

目前只支持 `type: 'json'` 的 body 转换。

## 🧪 测试建议

1. **创建节点**: 拖拽 HTTP 请求节点到画布
2. **配置节点**:
   - 设置 URL: `http://127.0.0.1/api/users`
   - 选择 Method: POST
   - 添加 Header: `Content-Type: application/json`
   - 添加 Body: `{"user": "1223"}`
3. **导出查看**: 导出决策图，检查 JSON 格式
4. **验证字段**:
   - ✅ `expressions[0].value` 包含正确的 `;;` 分隔的字符串
   - ✅ `expr_asts[0].value` 是包含5个元素的数组
   - ✅ `meta.user` 和 `meta.proj` 有值

## 📚 参考资料

- **customNode 示例**: [graph (8).json](./graph (8).json) (lines 42-85)
- **custom-function 实现**: [custom-function.specification.tsx](./custom-function.specification.tsx)
- **custom-function-table**: [tab-custom-function-table.tsx](../../graph/tab-custom-function-table.tsx) (lines 87-110)

## 🎉 完成

HTTP 请求节点现在完全符合 customNode 的格式和逻辑规范，包括：

✅ 数据格式一致
✅ expressions 和 expr_asts 自动生成
✅ meta 数据自动填充
✅ 实时数据同步
✅ 构建成功，无错误

可以正常使用了！
