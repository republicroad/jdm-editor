export { EditorShellProvider, useEditorShell, type EditorShellContextValue } from './editor-shell.context';
export { createDefaultSimulate } from './default-simulate';
export type { EditorShellOptions, SimulateHandler, ShellSimulateResult } from './types';
export { GraphPersistenceError } from './persistence';
export { createGraphsHttpAdapter } from './graphs-http-adapter';
export { createIndexedDbAdapter, AUTO_VERSIONS_KEEP } from './indexed-db-adapter';
export { restoreVersion } from './restore';
export type { GraphPersistenceAdapter, GraphRecord, GraphRecordMeta, PersistenceErrorCode } from './persistence';
