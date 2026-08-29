import React from 'react';
import { JSONTree } from 'react-json-tree';
import { toast } from 'sonner';

import { copyToClipboard } from '../../helpers/utility';
import { useThemeMode } from '../../theme';
import { useT } from '../../theming/i18n';
import { Dropdown, Tooltip } from '../primitives';

export type FunctionDebuggerLogProps = {
  lines: string[];
  msSinceRun: number | null;
};

type JsonTheme = {
  string: string;
  constants: string;
  number: string;
  type: string;
  error: string;
  info: string;
};

const themes: Record<'dark' | 'light', JsonTheme> = {
  dark: {
    string: '#CE9178',
    number: '#B5CEA8',
    constants: '#569CD6',
    type: '#3DC9B0',
    error: '#E51400',
    info: 'rgba(0, 0, 0, 0.65)',
  },
  light: {
    string: '#A31515',
    number: '#098658',
    constants: '#0000FF',
    type: '#008080',
    error: '#E51400',
    info: 'rgba(0, 0, 0, 0.65)',
  },
};

export const FunctionDebuggerLog: React.FC<FunctionDebuggerLogProps> = ({ lines, msSinceRun }) => {
  const mode = useThemeMode();
  const t = useT();
  const jsonTheme = themes[mode ?? 'light'];

  return (
    <div className='flex items-start justify-between border-b border-[var(--grl-color-border-fade)] pl-4 pr-6 text-xs leading-[var(--grl-line-height)] text-[var(--grl-color-text-base)] [font-family:var(--mono-font-family)]'>
      <Dropdown
        trigger={['contextMenu']}
        menu={{
          items: [
            {
              key: 'copy',
              label: t('func.debugger.copy'),
              onClick: async () => {
                await copyToClipboard(lines.length === 1 ? lines[0] : `[${lines.join(', ')}]`);
                toast.success('Copied to clipboard');
              },
            },
          ],
        }}
      >
        <div className='grl-function__debugger__log__values'>
          {lines.map((line, i) => {
            const data = safeParseJson(line);

            return (
              <JSONTree
                key={i}
                data={data}
                shouldExpandNodeInitially={() => false}
                labelRenderer={(keyPath: readonly (string | number)[], nodeType) => {
                  const parts: React.ReactNode[] = [];

                  const lastPart = keyPath?.[0];
                  if (lastPart !== 'root') {
                    parts.push(
                      <>
                        <span style={{ color: jsonTheme.constants }}>{lastPart}</span>
                        {': '}
                      </>,
                    );
                  }

                  if (keyPath.length >= 1) {
                    let paths = [...keyPath];
                    paths.pop();
                    paths = paths.reverse();

                    parts.push(objectRenderer(jsonTheme)(lens(data, paths), nodeType));
                  }

                  return <>{parts}</>;
                }}
                valueRenderer={valueRenderer(jsonTheme)}
                theme={
                  {
                    base00: 'var(--card)',
                    base03: 'var(--grl-color-text-base)',
                    base0B: 'var(--grl-color-text-base)',
                    base0D: 'var(--grl-color-text-base)',
                    /*
                     * Inline-tab flow + zero root indent — replaces the former
                     * .grl-function__debugger__log__values !important stylesheet
                     * war (HK-01). `value` stylable replicates library defaults
                     * for deeper levels; only top-level roots collapse
                     * flush-left like before. Escape-hatch cast: react-json-tree's
                     * union type doesn't model base16 strings alongside function
                     * stylables, though its runtime merge handles both.
                     */
                    tree: {
                      display: 'inline-block',
                    },
                    value: (
                      styling: { style?: React.CSSProperties },
                      _nodeType: string,
                      keyPath: readonly (string | number)[],
                    ) => ({
                      style: {
                        ...(styling?.style ?? {}),
                        paddingTop: '0.25em',
                        paddingRight: 0,
                        marginLeft: (keyPath?.length ?? 0) > 1 ? '0.875em' : 0,
                        WebkitUserSelect: 'text',
                        MozUserSelect: 'text',
                        wordWrap: 'break-word',
                        paddingLeft: (keyPath?.length ?? 0) > 1 ? '2.125em' : 0,
                        textIndent: '-0.5em',
                        wordBreak: 'break-all',
                      } as React.CSSProperties,
                    }),
                  } as React.ComponentProps<typeof JSONTree>['theme']
                }
              />
            );
          })}
        </div>
      </Dropdown>
      <div className='pt-[1ch] opacity-50'>
        {msSinceRun !== null && <Tooltip title={t('func.debugger.msSinceRun')}>{msSinceRun}ms</Tooltip>}
      </div>
    </div>
  );
};

const objectRenderer =
  (jsonTheme: JsonTheme) =>
  (data: any, nodeType: string): React.ReactNode => {
    if (nodeType === 'Object') {
      const objectData = data as Record<string, any>;
      const objectEntries = Object.entries(objectData);
      const renders = objectEntries.reduce(
        (acc: React.ReactNode[], [key, value], currentIndex) => [
          ...acc,
          <span key={key}>
            {key}: {valueRenderer(jsonTheme)(stringifyJsonData(value), value)}
            {currentIndex !== objectEntries.length - 1 && <>{', '}</>}
          </span>,
        ],
        [] satisfies React.ReactNode[],
      );

      return (
        <>
          {' {'}
          {renders}
          {'}'}
        </>
      );
    } else if (nodeType === 'Array') {
      const arrayData = data as unknown[];
      const renders = arrayData.reduce<React.ReactNode[]>(
        (acc, value, currentIndex) => [
          ...acc,
          <span key={currentIndex}>
            {valueRenderer(jsonTheme)(stringifyJsonData(value), value)}
            {currentIndex !== arrayData.length - 1 && <>{', '}</>}
          </span>,
        ],
        [],
      );

      return (
        <>
          {arrayData.length > 2 ? `(${arrayData.length})` : ''} [{renders}]
        </>
      );
    } else {
      return null;
    }
  };

const stringifyJsonData = (value: unknown): string => {
  switch (true) {
    case Array.isArray(value):
      return `Array(${(value as unknown[]).length})`;
    case typeof value === 'object':
      return '{...}';
    default:
      return JSON.stringify(value);
  }
};

const valueRenderer =
  (jsonTheme: JsonTheme) =>
  (valueAsStr: unknown, value: unknown): React.ReactNode => {
    const valueAsString = valueAsStr as string;
    if (typeof value === 'string') {
      if (valueAsString.startsWith('"Error:')) {
        return <span style={{ color: jsonTheme.error }}>{valueAsString.slice(1, -1)}</span>;
      }

      if (valueAsString.startsWith('"Info:')) {
        return <span style={{ color: jsonTheme.info }}>{valueAsString.slice(1, -1)}</span>;
      }

      return <span style={{ color: jsonTheme.string }}>{valueAsString}</span>;
    } else if (typeof value === 'boolean') {
      return <span style={{ color: jsonTheme.constants }}>{valueAsString}</span>;
    } else if (typeof value === 'number') {
      return <span style={{ color: jsonTheme.number }}>{valueAsString}</span>;
    }

    return valueAsString;
  };

const lens = (obj: any, path: (string | number)[]) => path.reduce((o, key) => (o && o[key] ? o[key] : null), obj);

const safeParseJson = (data: string): unknown => {
  if (typeof data !== 'string') {
    return undefined;
  }

  data = data.trim();
  if (!data) {
    return undefined;
  }

  try {
    return JSON.parse(data);
  } catch {
    return `[UNSERIALIZED]: ${data}`;
  }
};
