import { useMemo } from 'react';

import { getRequestDefinitions, getRequestExampleSources } from '../../../helpers/request-schema';
import type { RequestContentLike, RequestDefinition, RequestExampleSource } from '../../../helpers/request-schema';
import type { SimulatorExampleBinding } from '../context/dg-store.context';

export type ResolvedSimulatorExampleBinding = {
  nodeId: string;
  sourceIndex: number;
  sourceName?: string;
};

export type UseSimulatorRequestBindingParams = {
  inputNodeContent?: unknown;
  inputNodeId?: string;
  simulatorExampleBinding?: SimulatorExampleBinding | null;
  dataLabel?: string;
};

export type SimulatorRequestBinding = {
  requestSources: RequestExampleSource[];
  boundRequestSourceIndex: number;
  defaultRequestSourceIndex: number;
  defaultRequestSource?: RequestExampleSource;
  resolvedSimulatorExampleBinding: ResolvedSimulatorExampleBinding | null;
  currentBindingIdentity: string | null;
  requestDefinitions: RequestDefinition[];
  sourceOptions: Array<{ value: number; label: string }>;
  bindingName?: string;
  shouldShowSimulatorSourceSelect: boolean;
};

export const useSimulatorRequestBinding = ({
  inputNodeContent,
  inputNodeId,
  simulatorExampleBinding,
  dataLabel = 'Data',
}: UseSimulatorRequestBindingParams): SimulatorRequestBinding => {
  const requestContent = inputNodeContent as RequestContentLike | null | undefined;
  const requestSources = useMemo(
    () => getRequestExampleSources(requestContent, { dataLabel }),
    [requestContent, dataLabel],
  );
  const boundRequestSourceIndex = useMemo(() => {
    if (!simulatorExampleBinding || simulatorExampleBinding.nodeId !== inputNodeId) {
      return -1;
    }

    return requestSources[simulatorExampleBinding.sourceIndex] ? simulatorExampleBinding.sourceIndex : -1;
  }, [inputNodeId, requestSources, simulatorExampleBinding]);
  const defaultRequestSourceIndex =
    boundRequestSourceIndex >= 0 ? boundRequestSourceIndex : requestSources.length > 0 ? 0 : -1;
  const defaultRequestSource = defaultRequestSourceIndex >= 0 ? requestSources[defaultRequestSourceIndex] : undefined;
  const resolvedSimulatorExampleBinding = useMemo<ResolvedSimulatorExampleBinding | null>(() => {
    if (!inputNodeId || defaultRequestSourceIndex < 0 || !defaultRequestSource) {
      return null;
    }

    return {
      nodeId: inputNodeId,
      sourceIndex: defaultRequestSourceIndex,
      sourceName: defaultRequestSource.name,
    };
  }, [defaultRequestSource, defaultRequestSourceIndex, inputNodeId]);
  const currentBindingIdentity = useMemo(
    () => (simulatorExampleBinding ? `${simulatorExampleBinding.nodeId}:${simulatorExampleBinding.sourceIndex}` : null),
    [simulatorExampleBinding],
  );
  const requestDefinitions = useMemo(() => getRequestDefinitions(requestContent), [requestContent]);
  const sourceOptions = useMemo(
    () => requestSources.map((source, index) => ({ value: index, label: source.name })),
    [requestSources],
  );
  const bindingName = useMemo(
    () => (boundRequestSourceIndex >= 0 ? requestSources[boundRequestSourceIndex]?.name : undefined),
    [boundRequestSourceIndex, requestSources],
  );
  const shouldShowSimulatorSourceSelect = Boolean(bindingName) && Boolean(inputNodeId) && requestSources.length > 1;

  return {
    requestSources,
    boundRequestSourceIndex,
    defaultRequestSourceIndex,
    defaultRequestSource,
    resolvedSimulatorExampleBinding,
    currentBindingIdentity,
    requestDefinitions,
    sourceOptions,
    bindingName,
    shouldShowSimulatorSourceSelect,
  };
};
