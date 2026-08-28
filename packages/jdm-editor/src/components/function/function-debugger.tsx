import { ExportOutlined, FormatPainterOutlined, PlusOutlined } from '@/icons';
import { Button, Tabs, Tooltip, Typography } from '../primitives';
import type { editor } from 'monaco-editor';
import React, { useMemo, useState } from 'react';
import { match } from 'ts-pattern';

import typeScriptIcon from '../../assets/typescript.svg?inline';
import type { SimulationTrace, SimulationTraceDataFunction } from '../decision-graph/simulator/simulation.types';
import { FunctionDebuggerLog } from './function-debugger-log';
import { type FunctionLibrary } from './helpers/libs';

enum TabKey {
  Console = 'Console',
  Libraries = 'Libraries',
}

export type FunctionDebuggerProps = {
  trace?: SimulationTrace<SimulationTraceDataFunction>;
  editor?: editor.IStandaloneCodeEditor;
  editorValue?: string;
  libraries: FunctionLibrary[];
  disabled?: boolean;
};

export const FunctionDebugger: React.FC<FunctionDebuggerProps> = ({
  trace,
  editor,
  libraries = [],
  editorValue,
  disabled,
}) => {
  const traceLog = trace?.traceData?.log || [];
  const [activeTab, setActiveTab] = useState<TabKey>(TabKey.Console);

  return (
    <div className='h-full border-l border-[var(--border)]'>
      <div className='flex h-full flex-col overflow-hidden bg-[var(--card)]'>
        <div className='flex shrink-0 items-center border-b border-[var(--border)] bg-[var(--grl-color-primary-bg-fade)]'>
          <Tabs
            rootClassName='grl-inline-tabs'
            size='small'
            style={{ width: '100%' }}
            items={Object.values(TabKey).map((t) => ({ key: t, label: t }))}
            activeKey={activeTab}
            onChange={(t) => setActiveTab(t as TabKey)}
            tabBarExtraContent={
              <div style={{ marginRight: 8 }}>
                <Tooltip title='Format code' placement='bottomLeft'>
                  <Button
                    size='small'
                    type='text'
                    icon={<FormatPainterOutlined />}
                    onClick={() => editor?.getAction?.('editor.action.formatDocument')?.run?.()}
                  />
                </Tooltip>
              </div>
            }
          />
        </div>
        <div className='grow overflow-y-auto'>
          {match(activeTab)
            .with(TabKey.Console, () => (
              <>
                {traceLog.length === 0 && (
                  <FunctionDebuggerLog
                    lines={['"Info: Use console.log and run simulation to debug your code."']}
                    msSinceRun={null}
                  />
                )}

                {traceLog.map((log, i) => (
                  <FunctionDebuggerLog key={i} lines={log.lines} msSinceRun={log.msSinceRun} />
                ))}
              </>
            ))
            .with(TabKey.Libraries, () => (
              <div className='flex flex-col'>
                {libraries.map((lib) => (
                  <FunctionLibraryItem
                    key={lib.name}
                    lib={lib}
                    disabled={disabled}
                    editorValue={editorValue}
                    onImport={() => {
                      if (!editor) {
                        return;
                      }

                      const importStatement = `import ${lib.importName ?? lib.name} from '${lib.name}';`;
                      editor.setValue(importStatement + '\n' + editor.getValue());
                    }}
                  />
                ))}
              </div>
            ))
            .exhaustive()}
        </div>
      </div>
    </div>
  );
};

const FunctionLibraryItem: React.FC<{
  lib: FunctionLibrary;
  onImport?: () => void;
  editorValue?: string;
  disabled?: boolean;
}> = ({ lib, onImport, editorValue, disabled }) => {
  const canImport = useMemo(() => {
    if (!editorValue) {
      return true;
    }

    return !editorValue.includes(`from "${lib.name}"`) && !editorValue.includes(`from '${lib.name}'`);
  }, [lib.name, editorValue]);

  return (
    <div key={lib.name} className='flex items-center gap-2 border-b border-[var(--grl-color-border-fade)] p-2 no-underline'>
      <img alt='TypeScript Library' src={typeScriptIcon} height={18} />
      <Typography.Text strong>{lib.name}</Typography.Text>
      <Typography.Text type='secondary' style={{ fontSize: 12, marginTop: 1.5 }}>
        {lib.tagline}
      </Typography.Text>
      <div className='ml-auto flex gap-2'>
        <Tooltip title='Import library' placement='bottomLeft'>
          <Button
            type='text'
            size='small'
            icon={<PlusOutlined />}
            disabled={!canImport || disabled}
            onClick={onImport}
          />
        </Tooltip>
        <Tooltip title='Go to documentation' placement='bottomLeft'>
          <Button
            type='text'
            size='small'
            icon={<ExportOutlined />}
            href={lib.documentationUrl}
            target='_blank'
            disabled={!lib.documentationUrl}
          />
        </Tooltip>
      </div>
    </div>
  );
};
