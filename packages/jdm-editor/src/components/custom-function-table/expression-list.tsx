import { PlusCircleOutlined } from '@/icons';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { VariableType } from '@gorules/zen-engine-wasm';
import clsx from 'clsx';
import equal from 'fast-deep-equal/es6/react';
import React, { useEffect, useState } from 'react';

import type { FunctionScope } from '../../helpers/custom-function-schema';
import { isFunctionExpressionValue } from '../../helpers/custom-function-schema';
import { jsonSchemaToVariableType } from '../../helpers/json-schema';
import { isWasmAvailable } from '../../helpers/wasm';
import { useT } from '../../theming/i18n';
import { Button, Tag, Typography } from '../primitives';
import { useExpressionStore } from './context/expression-store.context';
import { ExpressionItem } from './expression-item';

export type ExpressionListProps = {
  customFunctions?: any;
  functionScope?: FunctionScope;
};

const emptyReturnSchema = {};

export const ExpressionList: React.FC<ExpressionListProps> = ({ customFunctions, functionScope }) => {
  const t = useT();
  const scopeMode = functionScope?.mode ?? 'free';
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
        const isFunctionExpression = expr.type === 'function' || isFunctionExpressionValue(expr.value);
        const calculatedType = isFunctionExpression
          ? jsonSchemaToVariableType(expr.returnSchema ?? emptyReturnSchema)
          : resultingVariableType.calculateType(Array.isArray(expr.value) ? expr.value.join(';;') : expr.value);
        resultingVariableType.set(`$.${expr.key}`, calculatedType);
      });

    setVariableType(resultingVariableType);
  }, [expressions, inputVariableType]);

  return (
    <>
      <div className={'expression-list'}>
        <SortableContext items={expressions.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <div className={clsx('expression-list__item', 'expression-list__item--heading')}>
            <div className={'expression-list__item__th expression-list__item__th--order'} />
            <Typography.Text type='secondary' className={'expression-list__item__th expression-list__item__th--key'}>
              {t('cf.key')}
            </Typography.Text>
            <Typography.Text type='secondary' className={'expression-list__item__th'}>
              {t('cf.expression')}
            </Typography.Text>
            <div className={'expression-list__item__th expression-list__item__th--scope'}>
              {scopeMode === 'legacy' && <Tag>{t('cf.legacy')}</Tag>}
            </div>
          </div>
          {(expressions || []).map((expression, index) => (
            <ExpressionItem
              key={expression.id}
              expression={expression}
              index={index}
              variableType={variableType}
              customFunctions={customFunctions}
              functionScope={functionScope}
            />
          ))}
        </SortableContext>
      </div>
      {permission === 'edit:full' && !disabled && (
        <div className={'expression-list__button-wrapper'}>
          <Button
            className='expression-list__button'
            icon={<PlusCircleOutlined />}
            type='link'
            onClick={() => addRowBelow()}
          >
            {t('cf.addRow')}
          </Button>
        </div>
      )}
    </>
  );
};
