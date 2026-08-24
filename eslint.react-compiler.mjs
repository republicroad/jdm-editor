// Advisory config: runs the React Compiler's ruleset over the editor sources
// as a warning-only CI signal (`pnpm lint:compiler`). Warnings never fail the
// build; flip to 'error' once the remaining violations are resolved.
import base from './eslint.config.mjs';
import reactCompiler from 'eslint-plugin-react-compiler';

export default [
  ...base,
  {
    plugins: { 'react-compiler': reactCompiler },
    files: ['packages/jdm-editor/src/**/*.{ts,tsx}'],
    rules: { 'react-compiler/react-compiler': 'warn' },
  },
];
