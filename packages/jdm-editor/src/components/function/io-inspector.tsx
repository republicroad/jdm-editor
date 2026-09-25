import React from 'react';
import { JSONTree } from 'react-json-tree';

import { useThemeMode } from '../../theme';

/** 共享的 JSONTree 主题（与 function-debugger-log.tsx 保持一致） */
const themes = {
  dark: {
    base00: 'var(--card)',
    base03: 'var(--grl-color-text-base)',
    base0B: 'var(--grl-color-text-base)',
    base0D: 'var(--grl-color-text-base)',
  },
  light: {
    base00: 'var(--card)',
    base03: 'var(--grl-color-text-base)',
    base0B: 'var(--grl-color-text-base)',
    base0D: 'var(--grl-color-text-base)',
  },
} as const;

const treeTheme = (mode: 'dark' | 'light') =>
  ({
    ...themes[mode],
    base00: 'var(--card)',
    base03: 'var(--grl-color-text-base)',
    base0B: 'var(--grl-color-text-base)',
    base0D: 'var(--grl-color-text-base)',
    tree: { display: 'inline-block' },
  }) as React.ComponentProps<typeof JSONTree>['theme'];

/** Input / Output 检查面板：折叠式 JSON 展示函数的入参与返回值 */
export const IoInspector: React.FC<{
  input: unknown;
  output: unknown;
}> = ({ input, output }) => {
  const mode = useThemeMode();
  const theme = treeTheme((mode ?? 'light') as 'dark' | 'light');
  const [open, setOpen] = React.useState<'input' | 'output' | null>(null);

  if (input == null && output == null) {
    return null;
  }

  const sections: Array<{ key: 'input' | 'output'; label: string; data: unknown }> = [
    { key: 'input', label: 'Input', data: input },
    { key: 'output', label: 'Output', data: output },
  ];

  return (
    <div className='border-b border-[var(--grl-color-border-fade)] text-xs [font-family:var(--mono-font-family)]'>
      {sections.map(({ key, label, data }) => {
        if (data == null) return null;
        const isOpen = open === key;
        return (
          <div key={key} className='border-b border-[var(--grl-color-border-fade)] last:border-b-0'>
            <button
              type='button'
              className='flex w-full items-center gap-1.5 px-4 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)] hover:bg-muted/40'
              onClick={() => setOpen(isOpen ? null : key)}
            >
              <span
                className='inline-block transition-transform'
                style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                ▸
              </span>
              {label}
            </button>
            {isOpen && (
              <div className='px-4 pb-1.5'>
                <JSONTree data={data} shouldExpandNodeInitially={() => true} theme={theme} hideRoot />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
