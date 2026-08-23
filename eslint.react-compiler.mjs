// PoC-only config: runs the React Compiler's ruleset over the editor sources to
// measure adoption readiness. Not wired into the standard lint gate.
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
