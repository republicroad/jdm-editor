import { CodeEditor } from '@republicroad/jdm-editor';
import { CodeIcon, Rows3Icon } from 'lucide-react';
import React, { useState } from 'react';

import { parseObjectLiteralRows, serializeObjectLiteralRows, type KeyValueRow } from '../../lib/http-request-protocol';
import PlusCircleIcon from '../../reui/icons/default/outline/plus-circle';
import TrashSquareIcon from '../../reui/icons/default/outline/trash-square';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import css from './custom-node.module.css';

export const Hint: React.FC<{ label: string; children: React.ReactElement }> = ({ label, children }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-72 break-all text-xs">{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export interface KeyValueEditorProps {
  label: string;
  addLabel: string;
  deleteLabel: string;
  valuePlaceholder: string;
  rawPlaceholder: string;
  value: string;
  onChange: (next: string) => void;
}

/** `{ k: expr, ... }` 对象字面量 ⇄ 键值行编辑器；无法解析时自动切原始表达式模式 */
export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  label,
  addLabel,
  deleteLabel,
  valuePlaceholder,
  rawPlaceholder,
  value,
  onChange,
}) => {
  const [mode, setMode] = useState<'structured' | 'raw'>(() =>
    parseObjectLiteralRows(value) !== null ? 'structured' : 'raw',
  );
  const [hint, setHint] = useState('');
  const [rows, setRows] = useState<KeyValueRow[]>(() => parseObjectLiteralRows(value) ?? []);
  const [syncedValue, setSyncedValue] = useState(value);
  const [lastEmitted, setLastEmitted] = useState<string | null>(null);

  if (syncedValue !== value && mode === 'structured') {
    const isOwnEcho = lastEmitted !== null && lastEmitted === value.trim();
    if (!isOwnEcho) {
      setSyncedValue(value);
      const parsed = parseObjectLiteralRows(value);
      if (parsed === null) {
        setHint('');
        setMode('raw');
      } else {
        setRows(parsed);
      }
    }
  }

  const writeRows = (next: KeyValueRow[]) => {
    setRows(next);
    const serialized = serializeObjectLiteralRows(next);
    setLastEmitted(serialized.trim());
    onChange(serialized);
  };

  const toggleMode = () => {
    if (mode === 'structured') {
      setHint('');
      setMode('raw');
      return;
    }
    const parsed = parseObjectLiteralRows(value);
    if (parsed !== null) {
      setHint('');
      setLastEmitted(null);
      setRows(parsed);
      setMode('structured');
    } else {
      setHint('当前内容无法解析为键值对，请检查对象字面量语法');
    }
  };

  return (
    <div className={css.form}>
      <div className={css.httpHeaderLine}>
        <span className="text-xs text-muted-foreground">{label}</span>
        <Hint label={mode === 'structured' ? '原始表达式模式' : '结构化模式'}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            aria-label={mode === 'structured' ? '原始表达式模式' : '结构化模式'}
            onClick={toggleMode}
          >
            {mode === 'structured' ? <CodeIcon /> : <Rows3Icon />}
          </Button>
        </Hint>
      </div>
      {mode === 'structured' ? (
        <>
          <div className={css.form}>
            {rows.map((row, index) => (
              <div className={css.httpKeyValueRow} key={index}>
                <Input
                  className="h-7 px-2 text-xs"
                  placeholder="名称"
                  value={row.key}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = { ...row, key: event.target.value };
                    writeRows(next);
                  }}
                />
                <CodeEditor
                  value={row.valueExpr}
                  onChange={(nextValue) => {
                    const next = [...rows];
                    next[index] = { ...row, valueExpr: nextValue };
                    writeRows(next);
                  }}
                  placeholder={valuePlaceholder}
                  maxRows={1}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  aria-label={deleteLabel}
                  onClick={() => writeRows(rows.filter((_, rowIndex) => rowIndex !== index))}
                >
                  <TrashSquareIcon />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-dashed text-xs"
            onClick={() => writeRows([...rows, { key: '', valueExpr: '' }])}
          >
            <PlusCircleIcon />
            {addLabel}
          </Button>
        </>
      ) : (
        <CodeEditor
          value={value}
          onChange={(nextValue) => {
            setHint('');
            onChange(nextValue);
          }}
          placeholder={rawPlaceholder}
          maxRows={3}
        />
      )}
      {hint && <p className="text-xs text-destructive">{hint}</p>}
    </div>
  );
};
