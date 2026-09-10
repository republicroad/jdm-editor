import {
  CodeEditor,
  GraphNode,
  type MinimalNodeProps,
  type MinimalNodeSpecification,
  jsonSchemaToVariableType,
  useDecisionGraphActions,
  useDecisionGraphState,
} from '@republicroad/jdm-editor';
import { FingerprintIcon } from 'lucide-react';
import React, { useState } from 'react';

import {
  CRYPTO_ALGORITHMS,
  CRYPTO_ENCODINGS,
  type CryptoAlgorithm,
  type CryptoEncoding,
  type CryptoFields,
  type CryptoMode,
  applyCryptoMode,
  deriveCryptoMode,
  parseCrypto,
  toCryptoValue,
} from '../../lib/crypto-protocol';
import { createSpecNode } from '../../lib/custom-node-registry';
import { uid } from '../../lib/custom-node-registry';
import type { CustomNodeConfig, CustomNodeExpression } from '../../lib/custom-node-types';
import PlusCircleIcon from '../../reui/icons/default/outline/plus-circle';
import TrashSquareIcon from '../../reui/icons/default/outline/trash-square';
import { Badge } from '../reui/badge';
import {
  Cascader,
  CascaderContent,
  CascaderEmpty,
  CascaderList,
  CascaderPanel,
  CascaderStatus,
  CascaderTrigger,
} from '../reui/cascader/cascader';
import { CascaderItems } from '../reui/cascader/cascader-item';
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from '../reui/cascader/cascader-nav';
import type { CascaderNode } from '../reui/cascader/cascader-types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import css from './custom-node.module.css';
import { Hint } from './key-value-editor';
import { LockedCornerBadge } from './locked-corner-badge';

const KIND = 'crypto';

const ALGORITHM_LABELS: Record<CryptoAlgorithm, string> = {
  md5: 'MD5',
  sha1: 'SHA1',
  sha256: 'SHA256',
  sha512: 'SHA512',
};

const ENCODING_LABELS: Record<CryptoEncoding, string> = {
  hex: 'HEX',
  base64: 'Base64',
  base64url: 'Base64URL',
};

const MODE_LABELS: Record<CryptoMode, string> = {
  plain: '普通摘要',
  hmac: 'HMAC 签名',
};

const CASCAADER_ITEMS: CascaderNode[] = (['plain', 'hmac'] as const).map((mode) => ({
  value: mode,
  label: MODE_LABELS[mode],
  children: (CRYPTO_ALGORITHMS as readonly CryptoAlgorithm[]).map((algorithm) => ({
    value: `${mode}.${algorithm}`,
    label: ALGORITHM_LABELS[algorithm],
    description: mode === 'hmac' ? '需配置密钥' : undefined,
  })),
}));

const leafValue = (mode: CryptoMode, algorithm: CryptoAlgorithm): string => `${mode}.${algorithm}`;

const parseLeafValue = (value: string): { mode: CryptoMode; algorithm: CryptoAlgorithm } | null => {
  const [mode, algorithm] = value.split('.');
  if ((mode !== 'plain' && mode !== 'hmac') || !(CRYPTO_ALGORITHMS as readonly string[]).includes(algorithm)) {
    return null;
  }
  return { mode, algorithm: algorithm as CryptoAlgorithm };
};

const useNodeConfig = (id: string): CustomNodeConfig | undefined =>
  useDecisionGraphState(({ decisionGraph }) => {
    const config = (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content?.config;
    return config as CustomNodeConfig | undefined;
  });

const nextExprKey = (list: CustomNodeExpression[]): string => {
  const used = new Set(list.map((item) => item.key));
  let index = list.length + 1;
  while (used.has(`result${index}`)) {
    index += 1;
  }
  return `result${index}`;
};

interface CryptoInstanceEditorProps {
  expr: CustomNodeExpression;
  onChange: (next: CustomNodeExpression) => void;
}

const CryptoInstanceEditor: React.FC<CryptoInstanceEditorProps> = ({ expr, onChange }) => {
  const fields: CryptoFields = parseCrypto(expr);
  // 模式是显式选择而非实时推导：首次切到 HMAC 时密钥尚为空，
  // 若按空槽位推导会立刻回落成普通摘要(触发器显示错误且序列化缺密钥)。
  const [mode, setMode] = useState<CryptoMode>(() => deriveCryptoMode(fields.secretExpr));
  // 外部把密钥填成非空(旧图/手改表达式)时，模式强制对齐为 HMAC。
  if (mode !== 'hmac' && deriveCryptoMode(fields.secretExpr) === 'hmac') {
    setMode('hmac');
  }
  const secretMissing = mode === 'hmac' && fields.secretExpr.trim() === '';

  const persistFields = (patch: Partial<CryptoFields>) => {
    onChange({ ...expr, value: toCryptoValue({ ...fields, ...patch }) });
  };

  const handleSelectionChange = (value: string) => {
    const parsed = parseLeafValue(value);
    if (!parsed) {
      return;
    }
    setMode(parsed.mode);
    persistFields(applyCryptoMode({ ...fields, algorithm: parsed.algorithm }, parsed.mode));
  };

  return (
    <div className={css.form}>
      <div className='flex h-8 items-center overflow-hidden rounded-md border border-input bg-transparent dark:bg-input/30'>
        <span className='h-full shrink-0 border-r border-input bg-muted/50 px-2 leading-8 text-xs text-muted-foreground'>
          输出键
        </span>
        <Input
          className='h-8 rounded-none border-0 bg-transparent text-xs shadow-none focus-visible:border-0 focus-visible:ring-0'
          placeholder='result'
          value={expr.key}
          onChange={(event) => onChange({ ...expr, key: event.target.value })}
        />
      </div>
      <span className='text-xs text-muted-foreground'>摘要方式</span>
      <div className='flex gap-2'>
        <Cascader
          items={CASCAADER_ITEMS}
          value={leafValue(mode, fields.algorithm)}
          onValueChange={handleSelectionChange}
          revealSelected={false}
        >
          <CascaderTrigger
            aria-label='摘要类型与算法'
            render={
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-8 w-[170px] flex-none justify-between px-2.5 text-xs font-normal'
              />
            }
          >
            <CascaderValue placeholder='选择摘要' />
          </CascaderTrigger>
          <CascaderContent className='w-60'>
            <CascaderPanel>
              <CascaderNav>
                <CascaderInput />
              </CascaderNav>
              <CascaderBreadcrumb />
              <CascaderEmpty />
              <CascaderList>
                <CascaderItems />
              </CascaderList>
              <CascaderStatus />
            </CascaderPanel>
          </CascaderContent>
        </Cascader>
        <CodeEditor
          value={fields.inputExpr}
          onChange={(value) => persistFields({ inputExpr: value })}
          placeholder={'待摘要内容，如 input.phone 或 "文本"'}
          maxRows={3}
        />
      </div>
      {mode === 'hmac' && (
        <div className={css.form}>
          <span className='text-xs text-muted-foreground'>HMAC 密钥（必填）</span>
          <CodeEditor
            value={fields.secretExpr}
            onChange={(value) => persistFields({ secretExpr: value })}
            placeholder={'如 env.SECRET_KEY 或 "my-key"'}
            maxRows={1}
            aria-invalid={secretMissing || undefined}
          />
          {secretMissing && (
            <span className='text-xs text-destructive'>密钥为空时将按普通摘要执行，请填写密钥表达式。</span>
          )}
        </div>
      )}
      <div className='flex items-center justify-between gap-2'>
        <ToggleGroup
          type='single'
          variant='outline'
          size='sm'
          value={fields.encoding}
          aria-label='输出编码'
          className='justify-start gap-0'
          onValueChange={(value) => {
            if (value) {
              persistFields({ encoding: value as CryptoEncoding });
            }
          }}
        >
          {(CRYPTO_ENCODINGS as readonly CryptoEncoding[]).map((encoding) => (
            <ToggleGroupItem key={encoding} value={encoding} className='h-8 px-2.5 text-xs'>
              {ENCODING_LABELS[encoding]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <label className='flex flex-1 items-center justify-end gap-2 text-xs text-muted-foreground'>
          HEX 大写
          <Switch
            checked={fields.upperExpr.trim() === 'true'}
            onCheckedChange={(checked) => persistFields({ upperExpr: checked ? 'true' : '' })}
            aria-label='HEX 大写输出'
          />
        </label>
      </div>
    </div>
  );
};

interface CryptoRowProps {
  index: number;
  expr: CustomNodeExpression;
  selected: boolean;
  result?: string;
  onSelect: () => void;
  onRemove: () => void;
}

const CryptoRow: React.FC<CryptoRowProps> = ({ index, expr, selected, result, onSelect, onRemove }) => {
  const { algorithm, secretExpr } = parseCrypto(expr);
  const mode = deriveCryptoMode(secretExpr);

  return (
    <div
      className={`${css.listRow}${selected ? ` ${css.listRowSelected}` : ''}${selected ? ' bg-primary/10' : ''}`}
      onClick={onSelect}
    >
      <div className={css.listRowHeader}>
        <span className='text-xs font-medium'>摘要 {index + 1}</span>
        <div className={css.listRowActions}>
          {result && (
            <Hint label={result}>
              <Badge variant='success' size='xs' radius='full' className='max-w-20 truncate font-mono'>
                {result.length > 8 ? `${result.slice(0, 8)}…` : result}
              </Badge>
            </Hint>
          )}
          <Badge variant={mode === 'hmac' ? 'info' : 'secondary'} size='xs' radius='full'>
            {MODE_LABELS[mode]}
          </Badge>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-6 w-6 p-0'
            aria-label='删除摘要'
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <TrashSquareIcon />
          </Button>
        </div>
      </div>
      <div className={css.listRowValue}>{ALGORITHM_LABELS[algorithm]}</div>
    </div>
  );
};

export const CryptoTab: React.FC<{ id: string }> = ({ id }) => {
  const graphActions = useDecisionGraphActions();
  const config = useNodeConfig(id);
  const output = useDecisionGraphState(({ simulate }) => simulate?.result?.trace?.[id]?.output);
  const outputs = (output ?? {}) as Record<string, unknown>;
  const expressions = config?.expressions ?? [];
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (selectedIndex >= expressions.length) {
    setSelectedIndex(expressions.length > 0 ? expressions.length - 1 : -1);
  }
  const selected = selectedIndex >= 0 ? expressions[selectedIndex] : undefined;

  const persistExpressions = (next: CustomNodeExpression[]) => {
    const nextConfig: CustomNodeConfig = {
      locked: config?.locked,
      inputField: config?.inputField ?? null,
      outputPath: config?.outputPath ?? null,
      passThrough: config?.passThrough ?? true,
      expressions: next,
    };
    graphActions.updateNode(id, (draft) => {
      draft.content.config = nextConfig;
      return draft;
    });
  };

  const addDigest = () => {
    const next = [
      ...expressions,
      {
        id: uid(),
        key: nextExprKey(expressions),
        value: toCryptoValue({
          inputExpr: '',
          algorithm: 'sha256',
          secretExpr: '',
          encoding: 'hex',
          upperExpr: '',
        }),
      },
    ];
    persistExpressions(next);
    setSelectedIndex(next.length - 1);
  };

  const removeDigest = (index: number) => {
    persistExpressions(expressions.filter((_, i) => i !== index));
  };

  return (
    <div className={css.tabSplit}>
      <div className={css.tabList}>
        <div className={css.listRows}>
          {expressions.map((expr, index) => (
            <CryptoRow
              key={expr.id}
              index={index}
              expr={expr}
              selected={index === selectedIndex}
              result={typeof outputs[expr.key] === 'string' ? (outputs[expr.key] as string) : undefined}
              onSelect={() => setSelectedIndex(index)}
              onRemove={() => removeDigest(index)}
            />
          ))}
        </div>
        <div className={css.listAdd}>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-7 w-full border-dashed text-xs'
            onClick={addDigest}
          >
            <PlusCircleIcon />
            添加摘要
          </Button>
        </div>
      </div>
      <div className={css.tabDetail}>
        {selected ? (
          <div className={css.form}>
            <span className='text-xs text-muted-foreground'>
              摘要 {selectedIndex + 1} · 输出键：{selected.key}
            </span>
            <CryptoInstanceEditor
              key={selected.id}
              expr={selected}
              onChange={(next) => {
                const updated = [...expressions];
                updated[selectedIndex] = next;
                persistExpressions(updated);
              }}
            />
          </div>
        ) : (
          <span className='text-xs text-muted-foreground'>尚未配置摘要，点击左侧「添加摘要」。</span>
        )}
      </div>
    </div>
  );
};

const CryptoNode: React.FC<MinimalNodeProps & { specification: MinimalNodeSpecification }> = ({
  id,
  data,
  selected,
  specification,
}) => {
  const graphActions = useDecisionGraphActions();

  const config = useDecisionGraphState(({ decisionGraph, simulate }) => {
    return {
      config: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content?.config as
        | CustomNodeConfig
        | undefined,
      output: simulate?.result?.trace?.[id]?.output as Record<string, unknown> | undefined,
    };
  });

  const expressions = config?.config?.expressions ?? [];
  const outputs = config?.output ?? {};

  return (
    <GraphNode
      id={id}
      specification={specification}
      name={data.name}
      isSelected={selected}
      noBodyPadding
      className='relative'
      actions={[
        <Button
          key='edit-crypto'
          type='button'
          variant='ghost'
          size='sm'
          className='h-7 px-2.5 text-xs'
          onClick={() => graphActions.openTab(id)}
        >
          编辑
        </Button>,
      ]}
    >
      {config?.config?.locked && <LockedCornerBadge />}
      <div className={css.summary}>
        <Badge variant='outline' className='font-mono text-[11px] opacity-75'>
          {KIND}
        </Badge>
        <div className={css.rows}>
          {expressions.length === 0 && (
            <div className={css.row}>
              <span className={css.rowValue}>未配置摘要</span>
            </div>
          )}
          {expressions.map((expr, index) => {
            const { algorithm, secretExpr } = parseCrypto(expr);
            const mode = deriveCryptoMode(secretExpr);
            const result = outputs[expr.key];
            return (
              <div className={css.row} key={expr.id}>
                <span className={css.rowKey}>摘要 {index + 1}</span>
                <span className={css.rowValue}>{ALGORITHM_LABELS[algorithm]}</span>
                {typeof result === 'string' && (
                  <Badge variant='success' size='xs' radius='full' className='max-w-16 truncate font-mono'>
                    {result.length > 6 ? `${result.slice(0, 6)}…` : result}
                  </Badge>
                )}
                <Badge variant={mode === 'hmac' ? 'info' : 'secondary'} size='xs' radius='full'>
                  {MODE_LABELS[mode]}
                </Badge>
              </div>
            );
          })}
        </div>
        <div className={css.returns}>
          <span className='text-xs text-muted-foreground'>摘要数量</span>
          <span className='text-xs'>{expressions.length}</span>
        </div>
      </div>
    </GraphNode>
  );
};

export const cryptoNode = createSpecNode({
  kind: KIND,
  displayName: '摘要签名',
  group: 'crypto',
  shortDescription: '计算字符串 MD5/SHA 摘要或 HMAC 签名，支持多个并行摘要实例',
  icon: <FingerprintIcon className='size-4' />,
  generateNode: ({ index }) => ({
    name: `${KIND}${index}`,
    config: {
      locked: true,
      inputField: null,
      outputPath: null,
      passThrough: true,
      expressions: [
        {
          id: uid(),
          key: 'result',
          value: toCryptoValue({
            inputExpr: '',
            algorithm: 'sha256',
            secretExpr: '',
            encoding: 'hex',
            upperExpr: '',
          }),
        },
      ],
    },
  }),
  renderTab: ({ id }) => <CryptoTab id={id} />,
  renderNode: CryptoNode,
  inferTypes: {
    needsUpdate: (content, prevContent) => JSON.stringify(content) !== JSON.stringify(prevContent),
    determineOutputType: ({ input, content }) => {
      let determined = jsonSchemaToVariableType({ type: 'object' });
      const config = (content as { config?: { passThrough?: boolean } } | undefined)?.config;
      if (config?.passThrough) {
        determined = input.merge(determined);
      }
      return determined;
    },
  },
});
