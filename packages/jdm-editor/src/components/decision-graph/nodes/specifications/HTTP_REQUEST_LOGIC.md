# HTTP请求节点数据逻辑说明

## 概述

HTTP请求节点现在完全实现了与 `customNode` 一致的数据逻辑，包括自动生成 `expressions` 和 `expr_asts` 字段。

## 数据转换逻辑

### 1. Meta 数据

```typescript
meta: {
  user: userId,     // 来自 TabHttpRequest 组件的 props
  proj: projectId   // 来自 TabHttpRequest 组件的 props
}
```

- **user**: 当前用户ID，从上层组件传递
- **proj**: 当前项目ID，从上层组件传递

### 2. Expressions 字段

`expressions` 字段存储字符串格式的表达式，使用 `;;` 分隔参数。

**格式**: `http_call_with_headers;;url;;method;;body;;headers`

**参数说明**:
1. **固定前缀**: `http_call_with_headers`
2. **URL**: 从 `config.url` 获取
3. **Method**: 从 `config.method` 获取，转换为小写并加引号，如 `"post"`
4. **Body**: 从 `config.body.content` 获取，JSON 格式，双引号转换为单引号
5. **Headers**: 从 `config.headers` 构建，只包含 enabled=true 的项，JSON 格式

**示例**:
```json
{
  "id": "http-expr-1",
  "key": "",
  "value": "http_call_with_headers;;http://127.0.0.1;;\"post\";;{'user':'1223'};;{'header':'456'}",
  "type": "function"
}
```

### 3. Expr_asts 字段

`expr_asts` 字段存储数组格式的表达式，每个参数为数组的一个元素。

**格式**: 数组，包含5个元素

**元素说明**:
1. **[0]**: 固定值 `"http_call_with_headers"`
2. **[1]**: URL 字符串
3. **[2]**: Method 字符串（带引号，如 `"post"`）
4. **[3]**: Body 对象字符串（JSON 格式，单引号）
5. **[4]**: Headers 对象字符串（JSON 格式，单引号）

**示例**:
```json
{
  "id": "http-expr-1",
  "key": "",
  "value": [
    "http_call_with_headers",
    "http://127.0.0.1",
    "\"post\"",
    "{'user':'1223'}",
    "{'header':'456'}"
  ]
}
```

## 实现细节

### buildExpressionsAndAsts 函数

位置: [tab-http-request.tsx](jdm-editor/packages/jdm-editor/src/components/decision-graph/graph/tab-http-request.tsx#L33)

```typescript
const buildExpressionsAndAsts = (cfg: HttpRequestConfig) => {
  const expressionId = cfg.expressions?.[0]?.id || crypto.randomUUID();

  // 1. 构建 headers 对象
  const headersObj: Record<string, string> = {};
  (cfg.headers || []).forEach(h => {
    if (h.enabled && h.key) {
      headersObj[h.key] = h.value;
    }
  });
  const headersStr = JSON.stringify(headersObj).replace(/"/g, "'");

  // 2. 构建 body 对象
  let bodyStr = '{}';
  if (cfg.body?.type === 'json' && cfg.body.content) {
    try {
      const bodyObj = JSON.parse(cfg.body.content);
      bodyStr = JSON.stringify(bodyObj).replace(/"/g, "'");
    } catch {
      bodyStr = '{}';
    }
  }

  // 3. 构建 method 字符串
  const methodStr = `"${(cfg.method || 'GET').toLowerCase()}"`;

  // 4. 构建 URL
  const url = cfg.url || '';

  // 5. 构建 value 数组
  const valueArray = [
    'http_call_with_headers',
    url,
    methodStr,
    bodyStr,
    headersStr
  ];

  // 6. 构建 expressions (字符串格式)
  const expressionValue = valueArray.join(';;');

  return {
    expressions: [
      {
        id: expressionId,
        key: '',
        value: expressionValue,
        type: 'function' as const
      }
    ],
    expr_asts: [
      {
        id: expressionId,
        key: '',
        value: valueArray
      }
    ]
  };
};
```

### 更新触发

每次用户修改以下任何字段时，都会自动触发 `expressions` 和 `expr_asts` 的重新构建：

- `method` - 请求方法
- `url` - 请求URL
- `headers` - 请求头列表
- `body` - 请求体
- 以及其他任何配置更新

## 完整示例

### 用户输入

- **Method**: POST
- **URL**: http://127.0.0.1/api/users
- **Headers**:
  - Content-Type: application/json (enabled)
  - Authorization: Bearer token123 (enabled)
- **Body** (JSON):
  ```json
  {"user": "1223", "action": "create"}
  ```

### 生成的数据

```json
{
  "expressions": [
    {
      "id": "...",
      "key": "",
      "value": "http_call_with_headers;;http://127.0.0.1/api/users;;\"post\";;{'user':'1223','action':'create'};;{'Content-Type':'application/json','Authorization':'Bearer token123'}",
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
        "{'user':'1223','action':'create'}",
        "{'Content-Type':'application/json','Authorization':'Bearer token123'}"
      ]
    }
  ]
}
```

## 与 customNode 的对比

### customNode (graph 8.json)
```json
{
  "expressions": [
    {
      "id": "4092483e-08fc-4dcf-9e83-89ce99df7a80",
      "key": "",
      "value": "http_call_with_headers;;http://127.0.0.1;;\"post\";;{'user':\"1223\"};;{'header':\"456\"}",
      "type": "function"
    }
  ],
  "expr_asts": [
    {
      "id": "4092483e-08fc-4dcf-9e83-89ce99df7a80",
      "key": "",
      "value": [
        "http_call_with_headers",
        "http://127.0.0.1",
        "\"post\"",
        "{'user':\"1223\"}",
        "{'header':\"456\"}"
      ]
    }
  ]
}
```

### httpRequestNode (现在)
```json
{
  "expressions": [
    {
      "id": "http-expr-1",
      "key": "",
      "value": "http_call_with_headers;;http://127.0.0.1/api/users;;\"post\";;{'user':'1223','action':'create'};;{'Content-Type':'application/json','Authorization':'Bearer token123'}",
      "type": "function"
    }
  ],
  "expr_asts": [
    {
      "id": "http-expr-1",
      "key": "",
      "value": [
        "http_call_with_headers",
        "http://127.0.0.1/api/users",
        "\"post\"",
        "{'user':'1223','action':'create'}",
        "{'Content-Type':'application/json','Authorization':'Bearer token123'}"
      ]
    }
  ]
}
```

**格式完全一致！** ✅

## 特殊处理

### Headers 过滤

只有 `enabled: true` 的 headers 会被包含在 expressions 中：

```typescript
(cfg.headers || []).forEach(h => {
  if (h.enabled && h.key) {  // 只处理启用的headers
    headersObj[h.key] = h.value;
  }
});
```

### Body 类型处理

目前只支持 JSON 类型的 body：

```typescript
if (cfg.body?.type === 'json' && cfg.body.content) {
  try {
    const bodyObj = JSON.parse(cfg.body.content);
    bodyStr = JSON.stringify(bodyObj).replace(/"/g, "'");
  } catch {
    bodyStr = '{}';  // 解析失败时使用空对象
  }
}
```

### 引号转换

所有 JSON 对象的双引号都会转换为单引号，以匹配 customNode 的格式：

```typescript
JSON.stringify(obj).replace(/"/g, "'")
```

## 自动更新

每次调用 `updateConfig()` 时，都会自动：

1. 更新 `meta` 信息（user 和 proj）
2. 重新构建 `expressions` 和 `expr_asts`
3. 保存到节点配置中

用户无需手动维护这些字段，系统会自动保持数据同步。

## 测试

完整的示例 JSON 文件：
- [http-request-complete-example.json](/Users/zhangyulong/Downloads/http-request-complete-example.json)

你可以使用这个文件测试 HTTP 请求节点的完整功能。
