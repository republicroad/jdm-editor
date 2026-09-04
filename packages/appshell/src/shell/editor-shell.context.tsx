import React, { createContext, useContext, useMemo } from 'react';
import type { CustomNodeSpecification } from '@republicroad/jdm-editor';

import { useCustomNodes } from '../hooks/useCustomNodes';
import { createAnonymousAdapter } from '../lib/auth/adapter';
import { createUserResolver, type UserResolver } from '../lib/user-resolver';
import type { CustomNodeNamespace } from '../lib/custom-node-types';

import { createDefaultSimulate } from './default-simulate';
import type { GraphPersistenceAdapter } from './persistence';
import type { EditorShellOptions, SimulateHandler } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 与 jdm-editor 内部 customNodes 类型约定一致
type CustomNodeSpec = CustomNodeSpecification<object, any>;

export interface EditorShellContextValue {
  customNodes: CustomNodeSpec[];
  schema: CustomNodeNamespace[] | null;
  ready: boolean;
  userResolver: UserResolver;
  runSimulate: SimulateHandler;
  /** 图持久化适配器：注入后页面打开/另存走宿主存储；未注入则回退浏览器本地文件 */
  persistence?: GraphPersistenceAdapter;
}

const EditorShellContext = createContext<EditorShellContextValue | null>(null);

export const EditorShellProvider: React.FC<{ options?: EditorShellOptions; children: React.ReactNode }> = ({
  options,
  children,
}) => {
  const { schemaSource, authAdapter, simulate, persistence } = options ?? {};
  const { customNodes, schema, ready } = useCustomNodes({ schemaSource });

  const userResolver = useMemo(() => createUserResolver(authAdapter ?? createAnonymousAdapter()), [authAdapter]);
  const runSimulate = useMemo(() => simulate ?? createDefaultSimulate(), [simulate]);

  const value = useMemo<EditorShellContextValue>(
    () => ({ customNodes, schema, ready, userResolver, runSimulate, persistence }),
    [customNodes, schema, ready, userResolver, runSimulate, persistence],
  );

  return <EditorShellContext.Provider value={value}>{children}</EditorShellContext.Provider>;
};

export const useEditorShell = (): EditorShellContextValue => {
  const value = useContext(EditorShellContext);
  if (!value) {
    throw new Error('useEditorShell must be used within EditorShellProvider');
  }
  return value;
};
