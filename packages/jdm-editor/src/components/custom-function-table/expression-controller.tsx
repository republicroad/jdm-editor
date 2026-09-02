import equal from 'fast-deep-equal/es6/react';
import type React from 'react';
import { useEffect, useRef } from 'react';

import { type FunctionScope, healExpressionsForScope } from '../../helpers/custom-function-schema';
import type { ExpressionEntry, ExpressionStore } from './context/expression-store.context';
import { useExpressionStore, useExpressionStoreRaw } from './context/expression-store.context';

export type ExpressionControllerProps = {
  disabled?: boolean;
  defaultValue?: ExpressionEntry[];
  permission?: ExpressionStore['permission'];
  value?: ExpressionEntry[];
  onChange?: (value: ExpressionEntry[]) => void;
  functionScope?: FunctionScope;
};

export const ExpressionController: React.FC<ExpressionControllerProps> = ({
  value,
  onChange,
  defaultValue = [],
  disabled = false,
  permission = 'edit:full',
  functionScope,
}) => {
  const mounted = useRef<boolean>(false);
  const store = useExpressionStoreRaw();
  const { setExpressions, expressions } = useExpressionStore(({ setExpressions, expressions }) => ({
    setExpressions,
    expressions,
  }));

  useEffect(() => {
    store.setState({
      disabled,
      permission,
    });
  }, [disabled, permission]);

  useEffect(() => {
    if (!onChange) {
      return;
    }

    return store.subscribe((state, prevState) => {
      if (!equal(state.expressions, prevState.expressions)) {
        onChange?.(state.expressions);
      }
    });
  }, [store, onChange]);

  useEffect(() => {
    if (mounted.current && value && !equal(value, expressions)) {
      setExpressions(value);
    }
  }, [value]);

  useEffect(() => {
    if (value) {
      const healed = healExpressionsForScope(value, functionScope);
      setExpressions(healed ?? value);
    } else if (defaultValue) {
      setExpressions(defaultValue);
    }
    mounted.current = true;
  }, []);

  return null;
};
