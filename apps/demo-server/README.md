# @republicroad/demo-server

> **Demo only.** Stateless JDM model validate/execute over `@gorules/zen-engine`.
> No auth, no storage, no business logic — 每个响应携带 `X-JDM-Demo: true`。
> 生产级规则平台（鉴权/多租户/审计）见独立私有仓 `verdict`。

## API

| 方法 | 路径           | 说明                                                     |
| ---- | -------------- | -------------------------------------------------------- |
| GET  | `/healthz`     | 存活探针                                                 |
| POST | `/v1/validate` | body = JDM 决策图；zen 引擎级校验（图边界/节点/边结构）  |
| POST | `/v1/execute`  | body = `{ model, input, trace? }` → `{ result, trace? }` |

模型格式与编辑器导出的 `.json`（`application/vnd.gorules.decision`）同方言：
完整决策图需含 `inputNode` / `outputNode` 边界节点与 `edges` 连线。

## 示例

```bash
curl -s localhost:8787/v1/execute -H 'content-type: application/json' -d @- << 'EOF' | jq
{
  "input": { "customer": { "tier": "GOLD" } },
  "model": {
    "nodes": [
      { "id": "in-1", "type": "inputNode", "name": "Request", "position": { "x": 0, "y": 0 } },
      { "id": "dt-1", "type": "decisionTableNode", "name": "discount", "position": { "x": 200, "y": 0 },
        "content": {
          "hitPolicy": "first",
          "inputs": [{ "id": "i1", "name": "Tier", "field": "customer.tier", "fieldType": { "type": "string" } }],
          "outputs": [{ "id": "o1", "name": "Rate", "field": "discount.rate", "outputFieldType": { "type": "number" } }],
          "rules": [
            { "_id": "r1", "in-tier": "\"GOLD\"", "out-rate": "0.85" },
            { "_id": "r2", "in-tier": "", "out-rate": "0" }
          ],
          "executionMode": "single", "passThrough": false
        } },
      { "id": "out-1", "type": "outputNode", "name": "Response", "position": { "x": 400, "y": 0 } }
    ],
    "edges": [
      { "id": "e1", "sourceId": "in-1", "targetId": "dt-1" },
      { "id": "e2", "sourceId": "dt-1", "targetId": "out-1" }
    ]
  }
}
EOF
# → { "result": { "discount": { "rate": 0.85 } } }
```

## 本地运行（Bun 工具链）

```bash
pnpm install
pnpm --filter @republicroad/demo-server dev     # bun --watch, :8787
pnpm --filter @republicroad/demo-server test    # bun test
```

## Docker

```bash
docker compose up demo-server   # 仓库根 compose，:8787
```
