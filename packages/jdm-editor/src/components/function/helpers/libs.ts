// Raw .d.ts sources are inlined for CodeMirror completions. Vite's client
// types declare `*?raw` modules, so only the @types-scoped path below needs
// an explicit suppression.
// @ts-expect-error -- no module declaration for the @types-scoped ?raw path
import bigJs from '@types/big.js/index.d.ts?raw';
import dayjs from 'dayjs/index.d.ts?raw';

import defaultFn from './default-function.js?raw';
import globalDts from './global.d.ts?raw';
import http from './http.d.ts?raw';
import zen from './zen.d.ts?raw';
import zod from './zod.d.ts?raw';

export type FunctionLibrary = {
  name: string;
  tagline: string;
  typeDef: string;
  importName?: string;
  documentationUrl?: string;
};

export const functionLibraries: FunctionLibrary[] = [
  {
    name: 'big.js',
    tagline: 'Arbitrary-precision decimal arithmetic',
    importName: 'Big',
    typeDef: bigJs,
    documentationUrl: 'https://mikemcl.github.io/big.js/',
  },
  {
    name: 'dayjs',
    tagline: 'Date utilities',
    typeDef: dayjs,
    documentationUrl: 'https://day.js.org/docs/en/parse/parse',
  },
  {
    name: 'http',
    tagline: 'Promise based HTTP client',
    typeDef: http,
    documentationUrl: 'https://docs.gorules.io/reference/http',
  },
  {
    name: 'zen',
    tagline: 'Rules engine utilities',
    typeDef: zen,
    documentationUrl: 'https://docs.gorules.io/reference/zen',
  },
  {
    name: 'zod',
    tagline: 'Schema validation',
    importName: 'z',
    typeDef: zod,
    documentationUrl: 'https://zod.dev/',
  },
];

export const functionDefinitions = {
  globals: {
    'global.d.ts': globalDts,
  },
};

export const defaultFunctionValue = defaultFn;
