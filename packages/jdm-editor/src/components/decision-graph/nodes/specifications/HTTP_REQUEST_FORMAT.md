# HTTP请求节点格式更新说明

## 更新内容

HTTP请求节点的数据格式已更新为与 `customNode` 一致的结构，以便更好地集成到系统中。

## 新的数据结构

### 节点类型定义

```typescript
export type NodeHttpRequestData = {
  kind: 'http';
  config: HttpRequestConfig;
};
```

### 配置结构

```typescript
export type HttpRequestConfig = {
  // 基础字段（与customNode一致）
  version: 'v3';
  meta: {
    user?: string;
    proj?: string;
  };
  expressions: Expression[];
  expr_asts: Array<{
    id: string;
    key?: string;
    value: string[];
  }>;
  passThrough?: boolean;
  inputField?: string | null;
  outputPath?: string | null;
  executionMode?: 'single' | 'loop';

  // HTTP请求特有字段
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  url?: string;
  headers?: Array<{
    id: string;
    key: string;
    value: string;
    enabled: boolean;
  }>;
  params?: Array<{
    id: string;
    key: string;
    value: string;
    enabled: boolean;
  }>;
  body?: {
    type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary';
    content: string;
  };
  auth?: {
    type: 'none' | 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiValue?: string;
  };
  timeout?: number;
  followRedirects?: boolean;
};
```

## 关键字段说明

### 1. kind
- **值**: `'http'`
- **说明**: 标识节点类型，与 customNode 的 `kind` 字段格式一致

### 2. version
- **值**: `'v3'`
- **说明**: 配置版本号

### 3. meta
- **user**: 用户ID
- **proj**: 项目ID
- **说明**: 元数据信息，用于追踪节点的创建者和所属项目

### 4. expressions
- **格式**: 表达式数组
- **说明**: 存储表达式的字符串格式，使用 `;;` 分隔多个参数
- **示例**:
  ```json
  {
    "id": "expr-1",
    "key": "url",
    "value": "http_call_with_headers;;http://127.0.0.1;;\"post\";;{'user':\"1223\"};;{'header':\"456\"}",
    "type": "function"
  }
  ```

### 5. expr_asts
- **格式**: 解析后的表达式数组
- **说明**: 将 `expressions` 中的字符串按 `;;` 分割成数组格式
- **示例**:
  ```json
  {
    "id": "expr-1",
    "key": "url",
    "value": [
      "http_call_with_headers",
      "http://127.0.0.1",
      "\"post\"",
      "{'user':\"1223\"}",
      "{'header':\"456\"}"
    ]
  }
  ```

### 6. passThrough
- **默认值**: `true`
- **说明**: 是否将输入数据传递到输出

### 7. inputField
- **默认值**: `null`
- **说明**: 指定输入字段路径

### 8. outputPath
- **默认值**: `null`
- **说明**: 指定输出路径

### 9. executionMode
- **可选值**: `'single'` | `'loop'`
- **默认值**: `'single'`
- **说明**: 执行模式，single为单次执行，loop为循环执行

## JSON示例

完整的HTTP请求节点JSON示例请参考 [http-request-example.json](./http-request-example.json)

## 与 customNode 的对比

### customNode 格式
```json
{
  "type": "customNode",
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
      "executionMode": "single"
    }
  }
}
```

### httpRequestNode 格式（新）
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
      "method": "POST",
      "url": "http://...",
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

## 主要区别

1. **type字段**: `customNode` vs `httpRequestNode`
2. **kind字段**: 都是 `'http'`
3. **config结构**: httpRequestNode 在 customNode 的基础上增加了 HTTP 特有字段（method, url, headers, params, body, auth, timeout, followRedirects）

## 迁移指南

如果你有旧格式的HTTP请求节点数据，需要进行以下调整：

### 旧格式
```json
{
  "type": "httpRequestNode",
  "content": {
    "method": "POST",
    "url": "http://...",
    "headers": [...],
    ...
  }
}
```

### 新格式
```json
{
  "type": "httpRequestNode",
  "content": {
    "kind": "http",
    "config": {
      "version": "v3",
      "meta": { "user": "", "proj": "" },
      "expressions": [],
      "expr_asts": [],
      "passThrough": true,
      "inputField": null,
      "outputPath": null,
      "executionMode": "single",
      "method": "POST",
      "url": "http://...",
      "headers": [...],
      ...
    }
  }
}
```

## 更新的文件

1. [http-request.specification.tsx](./http-request.specification.tsx) - 节点规范定义
2. [tab-http-request.tsx](../../graph/tab-http-request.tsx) - Tab编辑器组件

## 兼容性

- ✅ 与 customNode 格式完全兼容
- ✅ 支持 expressions 和 expr_asts 字段
- ✅ 支持 meta 元数据
- ✅ 保留所有 HTTP 请求特有功能
