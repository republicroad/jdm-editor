import { PlayCircleOutlined } from '@ant-design/icons';
import { Button, Checkbox, Form, Input, Select, Space, Tabs, theme } from 'antd';
import React, { useState, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { P, match } from 'ts-pattern';

import { getNodeData } from '../../../helpers/node-data';
import { useDecisionGraphActions, useDecisionGraphState } from '../context/dg-store.context';
import type { NodeHttpRequestData, HttpRequestConfig } from '../nodes/specifications/http-request.specification';
import type { SimulationTrace, SimulationTraceDataExpression } from '../simulator/simulation.types';
import { EditableTable, type EditableTableItem } from './EditableTable';
import { BodyEditor, type BodyConfig } from './BodyEditor';
import { InputDataPreview, OutputDataPreview } from './input-data-preview';

export type TabHttpRequestProps = {
  id: string;
  userId?: string;
  projectId?: string | null;
  onRunNode?: () => void;
  runLoading?: boolean;
};

/**
 * HTTP请求编辑器组件 - 参考Postman设计
 */
export const TabHttpRequest: React.FC<TabHttpRequestProps> = ({ id, userId, projectId, onRunNode, runLoading }) => {
  const { token } = theme.useToken();
  const graphActions = useDecisionGraphActions();
  const { disabled, content } = useDecisionGraphState(({ disabled, decisionGraph }) => ({
    disabled,
    content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeHttpRequestData,
  }));

  const [activeTab, setActiveTab] = useState('params');

  // 获取输入输出数据用于预览
  const { nodeTrace, inputData } = useDecisionGraphState(
    ({ simulate, decisionGraph }) => ({
      nodeTrace: match(simulate)
        .with(
          { result: P.nonNullable },
          ({ result }) => (result.trace?.[id] as SimulationTrace<SimulationTraceDataExpression>) ?? null,
        )
        .otherwise(() => null),
      inputData: match(simulate)
        .with({ result: P.nonNullable }, ({ result }) =>
          result.trace?.[id] ? getNodeData(id, { trace: result.trace, decisionGraph }) : null
        )
        .otherwise(() => null),
    }),
  );

  // 获取配置对象
  const config = content?.config;

  /**
   * 构建 expressions 和 expr_asts
   * 格式: http_call_with_headers;;url;;method;;body;;headers
   */
  const buildExpressionsAndAsts = (cfg: HttpRequestConfig) => {
    const expressionId = cfg.expressions?.[0]?.id || crypto.randomUUID();

    // 构建 headers 对象字符串
    const headersObj: Record<string, string> = {};
    (cfg.headers || []).forEach(h => {
      if (h.enabled && h.key) {
        headersObj[h.key] = h.value;
      }
    });
    const headersStr = JSON.stringify(headersObj).replace(/"/g, "'");

    // 构建 body 对象字符串
    let bodyStr = '{}';

    // JSON类型的body
    if (cfg.body?.type === 'json' && cfg.body.content) {
      try {
        const bodyObj = JSON.parse(cfg.body.content);
        bodyStr = JSON.stringify(bodyObj).replace(/"/g, "'");
      } catch {
        bodyStr = '{}';
      }
    }

    // form-data 或 x-www-form-urlencoded 类型的body
    if ((cfg.body?.type === 'form-data' || cfg.body?.type === 'x-www-form-urlencoded') && cfg.body.formData) {
      const formObj: Record<string, string> = {};
      cfg.body.formData.forEach(item => {
        if (item.enabled && item.key) {
          formObj[item.key] = item.value;
        }
      });
      bodyStr = JSON.stringify(formObj).replace(/"/g, "'");
    }

    // raw 或 xml 类型的body
    if ((cfg.body?.type === 'raw' || cfg.body?.type === 'xml') && cfg.body.content) {
      try {
        // 尝试将文本内容包装为对象
        bodyStr = JSON.stringify({ content: cfg.body.content }).replace(/"/g, "'");
      } catch {
        bodyStr = '{}';
      }
    }

    // 构建 method 字符串
    const methodStr = `"${(cfg.method || 'GET').toLowerCase()}"`;

    // 构建 URL
    const url = cfg.url || '';

    // 构建 value 数组
    const valueArray = [
      'http_call_with_headers',
      url,
      methodStr,
      bodyStr,
      headersStr
    ];

    // 构建 expressions (字符串格式，用 ;; 分隔)
    const expressionValue = valueArray.join(';;');

    return {
      expressions: [
        {
          id: expressionId,
          key: expressionId,
          value: expressionValue,
          type: 'function' as const
        }
      ],
      expr_asts: [
        {
          id: expressionId,
          key: expressionId,
          value: valueArray
        }
      ]
    };
  };

  // 更新节点配置的辅助函数
  const updateConfig = (updates: Partial<HttpRequestConfig>) => {
    graphActions.updateNode(id, (draft) => {
      if (!draft.content.config) {
        draft.content.config = {} as HttpRequestConfig;
      }

      // 合并更新
      Object.assign(draft.content.config, updates);

      // 更新 meta 信息
      if (userId || projectId) {
        draft.content.config.meta = {
          user: userId || draft.content.config.meta?.user || '',
          proj: projectId || draft.content.config.meta?.proj || ''
        };
      }

      // 构建 expressions 和 expr_asts
      const { expressions, expr_asts } = buildExpressionsAndAsts(draft.content.config);
      draft.content.config.expressions = expressions;
      draft.content.config.expr_asts = expr_asts;

      return draft;
    });
  };

  // 添加参数
  const addParam = () => {
    const newParams = [
      ...(config?.params || []),
      { id: crypto.randomUUID(), key: '', value: '', enabled: true },
    ];
    updateConfig({ params: newParams });
  };

  // 删除参数
  const removeParam = (paramId: string) => {
    const newParams = (config?.params || []).filter((p) => p.id !== paramId);
    updateConfig({ params: newParams });
  };

  // 更新参数
  const updateParam = (paramId: string, field: string, value: any) => {
    const newParams = (config?.params || []).map((p) =>
      p.id === paramId ? { ...p, [field]: value } : p
    );
    updateConfig({ params: newParams });
  };

  // 添加Header
  const addHeader = () => {
    const newHeaders = [
      ...(config?.headers || []),
      { id: crypto.randomUUID(), key: '', value: '', enabled: true },
    ];
    updateConfig({ headers: newHeaders });
  };

  // 删除Header
  const removeHeader = (headerId: string) => {
    const newHeaders = (config?.headers || []).filter((h) => h.id !== headerId);
    updateConfig({ headers: newHeaders });
  };

  // 更新Header
  const updateHeader = (headerId: string, field: string, value: any) => {
    const newHeaders = (config?.headers || []).map((h) =>
      h.id === headerId ? { ...h, [field]: value } : h
    );
    updateConfig({ headers: newHeaders });
  };

  return (
    <PanelGroup direction="horizontal" style={{ height: '100%' }}>
      {/* 左侧：输入数据预览 */}
      <Panel defaultSize={25} minSize={15} maxSize={40}>
        <InputDataPreview data={inputData?.data} />
      </Panel>

      <PanelResizeHandle style={{ width: 4, backgroundColor: token.colorBorder }} />

      {/* 中间：编辑区 + 运行按钮 */}
      <Panel defaultSize={50} minSize={30}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 顶部工具栏 */}
          {onRunNode && (
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${token.colorBorder}`,
                backgroundColor: token.colorBgContainer,
              }}
            >
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={runLoading}
                onClick={onRunNode}
                size="small"
              >
                运行到此节点
              </Button>
            </div>
          )}

          {/* 编辑区 */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {/* URL栏 */}
            <Space.Compact style={{ marginBottom: 16, width: '100%' }}>
              <Select
                disabled={disabled}
                value={config?.method || 'GET'}
                onChange={(value) => updateConfig({ method: value })}
                style={{ width: 120 }}
                options={[
                  { value: 'GET', label: 'GET' },
                  { value: 'POST', label: 'POST' },
                  { value: 'PUT', label: 'PUT' },
                  { value: 'DELETE', label: 'DELETE' },
                  { value: 'PATCH', label: 'PATCH' },
                  { value: 'HEAD', label: 'HEAD' },
                  { value: 'OPTIONS', label: 'OPTIONS' },
                ]}
              />
              <Input
                disabled={disabled}
                placeholder="Enter request URL"
                value={config?.url || ''}
                onChange={(e) => updateConfig({ url: e.target.value })}
                style={{ flex: 1 }}
              />
            </Space.Compact>

            {/* 标签页 */}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              style={{ flex: 1 }}
              items={[
          {
            key: 'params',
            label: 'Params',
            children: (
              <EditableTable
                data={config?.params as EditableTableItem[] || []}
                disabled={disabled}
                showDescription={true}
                showType={false}
                onAdd={addParam}
                onRemove={removeParam}
                onUpdate={updateParam}
                addButtonText="Add Param"
                keyPlaceholder="Parameter Name"
                valuePlaceholder="Parameter Value"
                descriptionPlaceholder="Description (optional)"
              />
            ),
          },
          {
            key: 'auth',
            label: 'Authorization',
            children: (
              <div>
                <Form.Item label="Auth Type">
                  <Select
                    disabled={disabled}
                    value={config?.auth?.type || 'none'}
                    onChange={(value) => updateConfig({ auth: { ...config?.auth, type: value } })}
                    style={{ width: 200 }}
                    options={[
                      { value: 'none', label: 'No Auth' },
                      { value: 'bearer', label: 'Bearer Token' },
                      { value: 'basic', label: 'Basic Auth' },
                      { value: 'api-key', label: 'API Key' },
                    ]}
                  />
                </Form.Item>
                {config?.auth?.type === 'bearer' && (
                  <Form.Item label="Token">
                    <Input.Password
                      disabled={disabled}
                      placeholder="Enter bearer token"
                      value={config?.auth?.token || ''}
                      onChange={(e) =>
                        updateConfig({ auth: { ...config?.auth, type: 'bearer', token: e.target.value } })
                      }
                    />
                  </Form.Item>
                )}
                {config?.auth?.type === 'basic' && (
                  <>
                    <Form.Item label="Username">
                      <Input
                        disabled={disabled}
                        placeholder="Username"
                        value={config?.auth?.username || ''}
                        onChange={(e) =>
                          updateConfig({
                            auth: { ...config?.auth, type: 'basic', username: e.target.value },
                          })
                        }
                      />
                    </Form.Item>
                    <Form.Item label="Password">
                      <Input.Password
                        disabled={disabled}
                        placeholder="Password"
                        value={config?.auth?.password || ''}
                        onChange={(e) =>
                          updateConfig({
                            auth: { ...config?.auth, type: 'basic', password: e.target.value },
                          })
                        }
                      />
                    </Form.Item>
                  </>
                )}
                {config?.auth?.type === 'api-key' && (
                  <>
                    <Form.Item label="Key">
                      <Input
                        disabled={disabled}
                        placeholder="API Key Name"
                        value={config?.auth?.apiKey || ''}
                        onChange={(e) =>
                          updateConfig({
                            auth: { ...config?.auth, type: 'api-key', apiKey: e.target.value },
                          })
                        }
                      />
                    </Form.Item>
                    <Form.Item label="Value">
                      <Input.Password
                        disabled={disabled}
                        placeholder="API Key Value"
                        value={config?.auth?.apiValue || ''}
                        onChange={(e) =>
                          updateConfig({
                            auth: { ...config?.auth, type: 'api-key', apiValue: e.target.value },
                          })
                        }
                      />
                    </Form.Item>
                  </>
                )}
              </div>
            ),
          },
          {
            key: 'headers',
            label: 'Headers',
            children: (
              <EditableTable
                data={config?.headers as EditableTableItem[] || []}
                disabled={disabled}
                showDescription={true}
                showType={false}
                onAdd={addHeader}
                onRemove={removeHeader}
                onUpdate={updateHeader}
                addButtonText="Add Header"
                keyPlaceholder="Header Name"
                valuePlaceholder="Header Value"
                descriptionPlaceholder="Description (optional)"
              />
            ),
          },
          {
            key: 'body',
            label: 'Body',
            children: (
              <BodyEditor
                body={config?.body as BodyConfig}
                disabled={disabled}
                onChange={(body) => updateConfig({ body })}
              />
            ),
          },
          {
            key: 'settings',
            label: 'Settings',
            children: (
              <div>
                <Form.Item label="Request Timeout (ms)">
                  <Input
                    disabled={disabled}
                    type="number"
                    value={config?.timeout || 30000}
                    onChange={(e) => updateConfig({ timeout: Number(e.target.value) })}
                    style={{ width: 200 }}
                  />
                </Form.Item>
                <Form.Item label="Follow Redirects">
                  <Checkbox
                    disabled={disabled}
                    checked={config?.followRedirects !== false}
                    onChange={(e) => updateConfig({ followRedirects: e.target.checked })}
                  >
                    Automatically follow redirects
                  </Checkbox>
                </Form.Item>
              </div>
            ),
          },
        ]}
              />
            </div>
          </div>
        </Panel>

        <PanelResizeHandle style={{ width: 4, backgroundColor: token.colorBorder }} />

        {/* 右侧：输出数据预览 */}
        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <OutputDataPreview data={nodeTrace?.output} />
        </Panel>
      </PanelGroup>
    );
  };
