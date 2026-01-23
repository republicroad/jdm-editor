import { SendOutlined } from '@ant-design/icons';
import { Button } from 'antd';

import { useDecisionGraphActions } from '../../context/dg-store.context';
import { TabHttpRequest } from '../../graph/tab-http-request';
import { GraphNode } from '../graph-node';
import { NodeColor } from './colors';
import type { NodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';

/**
 * Expression表达式项
 */
export type Expression = {
  id: string;
  key?: string;
  value?: string;
  type?: 'expression' | 'function';
};

/**
 * HTTP请求节点配置结构（参考customNode格式）
 */
export type HttpRequestConfig = {
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
    description?: string;
  }>;
  params?: Array<{
    id: string;
    key: string;
    value: string;
    enabled: boolean;
    description?: string;
  }>;
  body?: {
    type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'xml';
    content: string;
    formData?: Array<{
      id: string;
      key: string;
      value: string;
      enabled: boolean;
      type: 'text' | 'file';
      description?: string;
    }>;
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

/**
 * HTTP请求节点数据结构（匹配customNode格式）
 */
export type NodeHttpRequestData = {
  kind: 'http';
  config: HttpRequestConfig;
};

/**
 * HTTP请求节点规范定义
 */
export const httpRequestSpecification: NodeSpecification<NodeHttpRequestData> = {
  type: NodeKind.HttpRequest,
  icon: <SendOutlined />,
  displayName: 'HTTP请求',
  documentationUrl: 'https://gorules.io/docs/user-manual/decision-modeling/decisions/http-request',
  shortDescription: 'Send HTTP requests',
  color: NodeColor.Purple,
  renderTab: ({ id, userId, projectId, onRunNode, runLoading }) => <TabHttpRequest id={id} userId={userId} projectId={projectId} onRunNode={onRunNode} runLoading={runLoading} />,
  generateNode: ({ index }) => ({
    name: `httpRequest${index}`,
    content: {
      kind: 'http',
      config: {
        version: 'v3',
        meta: {
          user: '',
          proj: '',
        },
        expressions: [],
        expr_asts: [],
        passThrough: true,
        inputField: null,
        outputPath: null,
        executionMode: 'single',
        method: 'GET',
        url: '',
        headers: [],
        params: [],
        body: {
          type: 'none',
          content: '',
        },
        auth: {
          type: 'none',
        },
        timeout: 30000,
        followRedirects: true,
      },
    },
  }),
  renderNode: ({ id, data, selected, specification, onRunNode, runLoading }) => {
    const graphActions = useDecisionGraphActions();
    return (
      <GraphNode
        id={id}
        specification={specification}
        name={data.name}
        isSelected={selected}
        onRunNode={onRunNode}
        runLoading={runLoading}
        actions={[
          <Button key='edit-http-request' type='text' onClick={() => graphActions.openTab(id)}>
            Edit Request
          </Button>,
        ]}
      />
    );
  },
};
