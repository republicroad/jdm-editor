import { cn } from '#lib/utils';
import * as React from 'react';

interface FormContextValue {
  values: Record<string, unknown>;
  setField: (name: string, value: unknown) => void;
}

const FormContext = React.createContext<FormContextValue | null>(null);

export interface FormProps extends React.HTMLAttributes<HTMLDivElement> {
  layout?: 'horizontal' | 'vertical' | 'inline';
  initialValues?: Record<string, unknown>;
  onValuesChange?: (changed: Record<string, unknown>, values: Record<string, unknown>) => void;
  onFinish?: (values: Record<string, unknown>) => void;
  id?: string;
}

const FormRoot: React.FC<FormProps> = ({ initialValues = {}, onValuesChange, className, children, ...rest }) => {
  const [values, setValues] = React.useState<Record<string, unknown>>(initialValues);
  const context = React.useMemo<FormContextValue>(
    () => ({
      values,
      setField: (name, value) => {
        setValues((previous) => {
          const changed = { [name]: value };
          const next = { ...previous, ...changed };
          onValuesChange?.(changed, next);
          return next;
        });
      },
    }),
    [values, onValuesChange],
  );

  return (
    <FormContext.Provider value={context}>
      <div className={cn('flex flex-col', className)} {...rest}>
        {children}
      </div>
    </FormContext.Provider>
  );
};

const extractValue = (event: unknown, valuePropName?: string): unknown => {
  if (valuePropName) return event;
  if (event && typeof event === 'object' && 'target' in event) {
    const target = (event as { target?: unknown }).target;
    if (target && typeof target === 'object' && 'value' in target) {
      return (target as { value: unknown }).value;
    }
  }
  return event;
};

const FormItem: React.FC<{
  name?: string;
  label?: React.ReactNode;
  valuePropName?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ name, label, valuePropName, className, style, children }) => {
  const context = React.useContext(FormContext);
  let content = children;

  if (name && context && React.isValidElement(children)) {
    const original = children.props as Record<string, unknown>;
    const valueProp = valuePropName ?? 'value';
    content = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      [valueProp]: context.values[name],
      onChange: (...args: unknown[]) => {
        context.setField(name, extractValue(args[0], valuePropName));
        (original.onChange as ((...a: unknown[]) => void) | undefined)?.(...args);
      },
    });
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)} style={style}>
      {label}
      {content}
    </div>
  );
};

export const Form = Object.assign(FormRoot, { Item: FormItem });
