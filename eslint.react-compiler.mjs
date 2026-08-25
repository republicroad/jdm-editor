// React Compiler config: runs the ruleset over editor sources as a blocking
// CI gate (`pnpm lint:compiler`). Test files are excluded (Probe pattern
// captures context via outer variables — a legitimate test helper, not a
// production component purity violation).
import base from './eslint.config.mjs';
import reactCompiler from 'eslint-plugin-react-compiler';

export default [
  ...base,
  {
    plugins: { 'react-compiler': reactCompiler },
    files: ['packages/jdm-editor/src/**/*.{ts,tsx}'],
    ignores: ['packages/jdm-editor/src/**/__tests__/**'],
    rules: { 'react-compiler/react-compiler': 'error' },
  },
];
