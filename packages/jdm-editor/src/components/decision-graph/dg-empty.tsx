import equal from 'fast-deep-equal/es6/react';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import type { DictionaryMap } from '../../theme';
import type { JdmUiMode } from '../decision-table/context/dt-store.context';
import {
  type DecisionGraphStoreType,
  useDecisionGraphActions,
  useDecisionGraphRaw,
  useDecisionGraphState,
} from './context/dg-store.context';
import { type DecisionGraphType } from './dg-types';
import { calculateDiffGraph } from './diff/utility';

export type DecisionGraphEmptyType = {
  id?: string;
  defaultValue?: DecisionGraphType;
  value?: DecisionGraphType;

  disabled?: boolean;

  /**
   * 画布 diff 对比模式（P2）：提供基线图后，画布叠加差异标记（新增/删除/修改
   * 节点与边按 _diff 元数据染色，见 decision-node）。建议配合 `disabled` 使用
   * （只读对比）；diff 标注仅存在于渲染投影，切回正常模式即消失。
   */
  diffBaseline?: DecisionGraphType;

  components?: DecisionGraphStoreType['state']['components'];
  customNodes?: DecisionGraphStoreType['state']['customNodes'];

  /** 治理谓词（批 23）：按 namespace/kind 过滤 customNodes——缺省不过滤（全量可用） */
  allowedNamespaces?: Set<string>;
  /** ⌘K 二期：宿主注入扩展命令（保存/验证/导出/皮肤等） */
  extraCommands?: Array<{
    id: string;
    group: string;
    label: string;
    icon?: React.ReactNode;
    keywords: string;
    run: () => void;
  }>;

  hideLeftToolbar?: DecisionGraphStoreType['state']['hideLeftToolbar'];

  name?: DecisionGraphStoreType['state']['name'];

  viewConfigCta?: DecisionGraphStoreType['state']['viewConfigCta'];
  viewConfig?: DecisionGraphStoreType['state']['viewConfig'];
  onViewConfigCta?: DecisionGraphStoreType['listeners']['onViewConfigCta'];

  defaultActivePanel?: string;
  panels?: DecisionGraphStoreType['state']['panels'];
  onPanelsChange?: DecisionGraphStoreType['listeners']['onPanelsChange'];

  simulate?: DecisionGraphStoreType['state']['simulate'];

  dictionaries?: DictionaryMap;
  mode?: JdmUiMode;

  onChange?: DecisionGraphStoreType['listeners']['onChange'];
  onReactFlowInit?: DecisionGraphStoreType['listeners']['onReactFlowInit'];

  /** ADR-013 批次三：Run all 执行槽位——宿主注入（appshell = simulateHandler 适配）；未注入时 Run all 不渲染 */
  fixturesRunner?: DecisionGraphStoreType['state']['fixturesRunner'];

  /** ADR-013 批次三：输入节点契约漂移事件流（数据装配归 kernel，宿主消费——如变更日志面板） */
  onContractEvent?: DecisionGraphStoreType['listeners']['onContractEvent'];

  onCodeExtension?: DecisionGraphStoreType['listeners']['onCodeExtension'];
  onFunctionReady?: DecisionGraphStoreType['listeners']['onFunctionReady'];
};

export const DecisionGraphEmpty: React.FC<DecisionGraphEmptyType> = ({
  id,
  defaultValue,
  value,
  name,
  disabled = false,
  diffBaseline,
  onChange,
  components,
  customNodes,
  allowedNamespaces,
  extraCommands,
  defaultActivePanel,
  hideLeftToolbar,
  panels,
  simulate,
  dictionaries,
  mode,
  viewConfigCta,
  viewConfig,
  onViewConfigCta,
  onPanelsChange,
  onReactFlowInit,
  onCodeExtension,
  onFunctionReady,
  fixturesRunner,
  onContractEvent,
}) => {
  const mountedRef = useRef(false);
  const graphActions = useDecisionGraphActions();
  const { stateStore, listenerStore } = useDecisionGraphRaw();
  const { decisionGraph, openTabs, activeTab } = useDecisionGraphState(({ decisionGraph, openTabs, activeTab }) => ({
    decisionGraph,
    openTabs,
    activeTab,
  }));

  const innerChange = useDebouncedCallback((graph: DecisionGraphType) => {
    onChange?.(graph);
  }, 100);

  useEffect(() => {
    if (viewConfig?.enabled) {
      const filtered = openTabs.filter((tab) => !!viewConfig?.permissions?.[tab]);

      stateStore.setState({
        openTabs: filtered,
        activeTab: !!viewConfig?.permissions?.[activeTab] ? activeTab : 'graph',
      });
    }
  }, [viewConfig]);

  // 治理谓词（批 23）：allowedNamespaces 过滤 customNodes——
  // 不传或空 Set = 全量可用（零回归）
  const filteredCustomNodes = useMemo(() => {
    const all = Array.isArray(customNodes) ? customNodes : [];
    if (!allowedNamespaces || allowedNamespaces.size === 0) {
      return all;
    }
    return all.filter((node) => allowedNamespaces.has(node.kind));
  }, [customNodes, allowedNamespaces]);

  useEffect(() => {
    stateStore.setState({
      id,
      disabled,
      components: Array.isArray(components) ? components : [],
      customNodes: Array.isArray(filteredCustomNodes) ? filteredCustomNodes : [],
      extraCommands: Array.isArray(extraCommands) ? extraCommands : [],
      panels,
      viewConfig,
      viewConfigCta,
      hideLeftToolbar,
      dictionaries,
      mode,
    });
  }, [
    id,
    disabled,
    components,
    filteredCustomNodes,
    allowedNamespaces,
    extraCommands,
    panels,
    viewConfig,
    viewConfigCta,
    hideLeftToolbar,
    dictionaries,
    mode,
  ]);

  useEffect(() => {
    stateStore.setState({ name: name ?? 'graph.json' });
  }, [name]);

  useEffect(() => {
    stateStore.setState({ simulate });
  }, [simulate]);

  useEffect(() => {
    stateStore.setState({ fixturesRunner: fixturesRunner ?? null });
  }, [fixturesRunner]);

  useEffect(() => {
    listenerStore.setState({
      onReactFlowInit,
      onPanelsChange,
      onCodeExtension,
      onFunctionReady,
      onViewConfigCta,
      onContractEvent,
    });
  }, [onReactFlowInit, onPanelsChange, onCodeExtension, onFunctionReady, onViewConfigCta, onContractEvent]);

  useEffect(() => {
    listenerStore.setState({ onChange: innerChange });
  }, [innerChange]);

  useEffect(() => {
    // diff 对比模式下由下方「diffBaseline 重算」effect 接管渲染投影，此处跳过
    if (value === undefined || diffBaseline) {
      return;
    }
    if (mountedRef.current && !equal(value, decisionGraph)) {
      graphActions.setDecisionGraph(value);
    }
  }, [value, diffBaseline]);

  useEffect(() => {
    if (value !== undefined) {
      graphActions.setDecisionGraph(
        diffBaseline
          ? calculateDiffGraph(value, diffBaseline, { customNodes: customNodes ?? [], components: components ?? [] })
          : value,
      );
    } else if (defaultValue !== undefined) {
      graphActions.setDecisionGraph(defaultValue);
    }

    stateStore.setState({
      activePanel: defaultActivePanel,
      hideLeftToolbar,
    });
    mountedRef.current = true;
  }, []);

  // diffBaseline 变化（切换对比版本 / 移除对比）→ 重算渲染投影或恢复裸图
  useEffect(() => {
    if (value === undefined) {
      return;
    }
    if (diffBaseline) {
      graphActions.setDecisionGraph(
        calculateDiffGraph(value, diffBaseline, { customNodes: customNodes ?? [], components: components ?? [] }),
      );
    } else if (mountedRef.current) {
      graphActions.setDecisionGraph(value);
    }
  }, [diffBaseline]);

  return null;
};
