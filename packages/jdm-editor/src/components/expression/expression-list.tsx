import { PlusCircleOutlined } from '@/icons';
import type { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Typography } from '../primitives';
import clsx from 'clsx';
import equal from 'fast-deep-equal/es6/react';
import React, { useEffect, useState } from 'react';

import { isWasmAvailable } from '../../helpers/wasm';
import { useExpressionStore } from './context/expression-store.context';
import { ExpressionItem } from './expression-item';

export type ExpressionListProps = {
  //
};

export const ExpressionList: React.FC<ExpressionListProps> = ({}) => {
  const { expressions, addRowBelow, permission, disabled, inputVariableType } = useExpressionStore(
    ({ expressions, addRowBelow, permission, disabled, inputVariableType }) => ({
      expressions,
      addRowBelow,
      permission,
      disabled,
      inputVariableType,
    }),
    equal,
  );

  const [variableType, setVariableType] = useState<VariableType>();

  useEffect(() => {
    if (!isWasmAvailable() || !inputVariableType) {
      return;
    }

    const resultingVariableType = inputVariableType.clone();
    expressions
      .filter((e) => e.key.length > 0)
      .forEach((expr) => {
        const calculatedType = resultingVariableType.calculateType(expr.value);
        resultingVariableType.set(`$.${expr.key}`, calculatedType);
      });

    setVariableType(resultingVariableType);
  }, [expressions, inputVariableType]);

  const listClass = 'flex flex-col box-border gap-px pb-px bg-[var(--grl-color-border-fade)]';
  const itemClass =
    'relative grid grid-cols-[40px_minmax(240px,1.1fr)_3fr_40px] items-start bg-[var(--grl-color-bg-container)] focus-within:[box-shadow:0_0_0_1px_var(--border)]';
  const thClass = 'p-3 pointer-events-none';

  return (
    <>
      <div className={listClass}>
        <div className={clsx(itemClass, 'sticky top-0 z-[15] [&>span]:text-xs')}>
          <div className={clsx(thClass, 'h-full')} />
          <Typography.Text type='secondary' className={thClass}>
            Key
          </Typography.Text>
          <Typography.Text type='secondary' className={thClass}>
            Expression
          </Typography.Text>
          <div />
        </div>
        {(expressions || []).map((expression, index) => (
          <ExpressionItem key={expression.id} expression={expression} index={index} variableType={variableType} />
        ))}
      </div>
      {permission === 'edit:full' && !disabled && (
        <div className='py-2 mb-[60px]'>
          <Button icon={<PlusCircleOutlined />} type='link' onClick={() => addRowBelow()}>
            Add row
          </Button>
        </div>
      )}
    </>
  );
};
