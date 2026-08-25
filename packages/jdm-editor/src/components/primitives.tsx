/**
 * JDM UI primitives.
 *
 * Thin, antd-shaped wrappers around the local shadcn/ui components so the
 * editor codebase keeps a small, consistent component surface. Import from
 * here instead of pulling UI libraries directly into feature modules.
 */
import * as React from 'react';
import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button as UiButton } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { DropdownMenuSub } from '@/components/ui/dropdown-menu';
import { DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Popover as UiPopover,
  PopoverContent as UiPopoverContent,
  PopoverTrigger as UiPopoverTrigger,
} from '@/components/ui/popover';
import { Tabs as UiTabs } from '@/components/ui/tabs';
import { TabsContent as UiTabsContent } from '@/components/ui/tabs';
import { TabsList as UiTabsList } from '@/components/ui/tabs';
import { TabsTrigger as UiTabsTrigger } from '@/components/ui/tabs';
import { Tooltip as UiTooltipRoot } from '@/components/ui/tooltip';
import { TooltipContent as UiTooltipContent } from '@/components/ui/tooltip';
import { TooltipProvider as UiTooltipProvider } from '@/components/ui/tooltip';
import { TooltipTrigger as UiTooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Button

type AntdButtonType = 'primary' | 'default' | 'dashed' | 'text' | 'link';
type AntdButtonSize = 'large' | 'middle' | 'small';

export interface AntdButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  type?: AntdButtonType;
  icon?: React.ReactNode;
  danger?: boolean;
  loading?: boolean;
  size?: AntdButtonSize;
  block?: boolean;
  shape?: 'circle' | 'round' | 'default';
  href?: string;
  target?: string;
}

export type ButtonProps = AntdButtonProps;

export const Button = React.forwardRef<
  HTMLButtonElement,
  AntdButtonProps & { ref?: React.Ref<HTMLButtonElement> }
>(({
  type = 'default',
  icon,
  danger = false,
  loading = false,
  size = 'middle',
  block = false,
  shape,
  href,
  target,
  className,
  children,
  disabled,
  ...rest
}, ref) => {
  const variant = (() => {
    if (danger && type === 'link') return 'link';
    if (danger && type !== 'text') return 'destructive';
    switch (type) {
      case 'primary':
        return danger ? 'destructive' : 'default';
      case 'text':
        return 'ghost';
      case 'link':
        return 'link';
      case 'dashed':
        return 'outline';
      default:
        return 'outline';
    }
  })();

  const sizeClass =
    size === 'large' ? 'h-10 px-6 text-base' : size === 'small' ? 'h-7 px-2.5 text-xs' : undefined;

  const inner = (
    <>
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </>
  );

  if (href) {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        target={target}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium underline-offset-4 hover:underline',
          variant === 'link' ? 'text-primary' : '',
          danger && type === 'link' && 'text-destructive',
          sizeClass,
          disabled && 'pointer-events-none opacity-50',
          className,
        )}
      >
        {inner}
      </a>
    );
  }

  return (
    <UiButton
      ref={ref}
      variant={variant as never}
      className={cn(
        sizeClass,
        type === 'dashed' && 'border-dashed',
        danger && type === 'link' && 'text-destructive',
        danger && type === 'text' && 'text-destructive hover:bg-destructive/10',
        block && 'w-full',
        (shape === 'circle' || shape === 'round') && 'rounded-full',
        !children && icon && 'px-2',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {inner}
    </UiButton>
  );
});

// ---------------------------------------------------------------------------
// Typography

const typoColorClass: Record<string, string> = {
  secondary: 'text-muted-foreground',
  success: 'text-[var(--grl-color-success)]',
  warning: 'text-[var(--grl-color-warning)]',
  danger: 'text-[var(--grl-color-error)]',
};

type Ellipsis = boolean | { tooltip?: React.ReactNode };

interface TextProps extends React.HTMLAttributes<HTMLSpanElement> {
  type?: keyof typeof typoColorClass;
  ellipsis?: Ellipsis;
  strong?: boolean;
}

const resolveEllipsisTitle = (ellipsis: Ellipsis | undefined) => {
  if (!ellipsis || typeof ellipsis !== 'object') return undefined;
  const tooltip = ellipsis.tooltip;
  if (typeof tooltip === 'string' || typeof tooltip === 'number') return String(tooltip);
  return undefined;
};

const Text: React.FC<TextProps> = ({ type, ellipsis, strong, className, style, children, ...rest }) => (
  <span
    title={resolveEllipsisTitle(ellipsis)}
    className={cn(
      'inline-block max-w-full align-bottom',
      ellipsis && 'truncate',
      strong && 'font-semibold',
      typoColorClass[type ?? ''],
      className,
    )}
    style={style}
    {...rest}
  >
    {children}
  </span>
);

const titleLevelClass: Record<number, string> = {
  1: 'text-2xl font-bold',
  2: 'text-xl font-bold',
  3: 'text-lg font-semibold',
  4: 'text-base font-semibold',
  5: 'text-sm font-semibold',
};

interface TitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5;
}

const Title: React.FC<TitleProps> = ({ level = 1, className, ...rest }) => {
  const Tag = (`h${Math.min(Math.max(level, 1), 5)}`) as 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  return <Tag className={cn(titleLevelClass[level], 'm-0', className)} {...rest} />;
};

const Paragraph: React.FC<TextProps> = ({ type, className, ...rest }) => (
  <p className={cn(typoColorClass[type ?? ''], className)} {...rest} />
);

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  type?: keyof typeof typoColorClass;
  ellipsis?: Ellipsis;
}

const Link: React.FC<LinkProps> = ({ type, ellipsis, className, children, ...rest }) => (
  <a
    title={resolveEllipsisTitle(ellipsis)}
    className={cn(
      'cursor-pointer underline-offset-4 hover:underline',
      ellipsis && 'inline-block max-w-full truncate align-bottom',
      typoColorClass[type ?? ''],
      className,
    )}
    {...rest}
  >
    {children}
  </a>
);

export const Typography = Object.assign(
  ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  { Text, Title, Paragraph, Link },
);

// ---------------------------------------------------------------------------
// Spin

export { Spin } from './primitives/spin';

// ---------------------------------------------------------------------------
// Tooltip

const placementSideMap: Record<string, 'top' | 'right' | 'bottom' | 'left'> = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
  topLeft: 'top',
  topRight: 'top',
  bottomLeft: 'bottom',
  bottomRight: 'bottom',
};

export const Tooltip: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    title?: React.ReactNode;
    placement?: keyof typeof placementSideMap;
    open?: boolean;
    children?: React.ReactNode;
  }
> = ({ title, placement = 'top', children }) => {
  if (!title || !children) {
    return <>{children}</>;
  }
  return (
    <UiTooltipProvider delayDuration={200}>
      <UiTooltipRoot>
        <UiTooltipTrigger asChild>
          {React.isValidElement(children) ? children : <span className="inline-flex">{children}</span>}
        </UiTooltipTrigger>
        <UiTooltipContent side={placementSideMap[placement] ?? 'top'}>{title}</UiTooltipContent>
      </UiTooltipRoot>
    </UiTooltipProvider>
  );
};

// ---------------------------------------------------------------------------
// Dropdown (menu schema subset of antd)

export interface AntdMenuItemType {
  key?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  type?: 'divider' | 'group';
  onClick?: (info: { key: string }) => void;
  children?: AntdMenuItemType[];
}

export interface AntdMenuProps {
  items?: AntdMenuItemType[];
  onClick?: (info: { key: string }) => void;
}

export type MenuProps = AntdMenuProps;

const MenuItemsRenderer: React.FC<{ items?: AntdMenuItemType[]; onClick?: AntdMenuProps['onClick'] }> = ({
  items,
  onClick,
}) =>
  items?.map((item, index) => {
    const itemKey = item.key ?? String(index);
    const handleSelect = () => (item.onClick ?? onClick)?.({ key: itemKey });
    return item.type === 'divider' ? (
      <DropdownMenuSeparator key={itemKey} />
    ) : item.children?.length ? (
      <DropdownMenuSub key={itemKey}>
        <DropdownMenuSubTrigger disabled={item.disabled}>{item.label}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <MenuItemsRenderer items={item.children} onClick={onClick} />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : (
      <DropdownMenuItem
        key={itemKey}
        disabled={item.disabled}
        variant={item.danger ? 'destructive' : 'default'}
        onSelect={handleSelect}
      >
        {item.icon}
        {item.label}
      </DropdownMenuItem>
    );
  }) ?? null;

export const Dropdown: React.FC<{
  menu?: AntdMenuProps;
  trigger?: Array<'click' | 'hover' | 'contextMenu'>;
  placement?: string;
  arrow?: boolean;
  overlayStyle?: React.CSSProperties;
  destroyPopupOnHide?: boolean;
  transitionName?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}> = ({ menu, children }) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      {React.isValidElement(children) ? (
        children
      ) : (
        <span className="inline-flex cursor-pointer items-center">{children}</span>
      )}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <MenuItemsRenderer items={menu?.items} onClick={menu?.onClick} />
    </DropdownMenuContent>
  </DropdownMenu>
);

// ---------------------------------------------------------------------------
// Popconfirm (AlertDialog-based)

export const Popconfirm: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    title?: React.ReactNode;
    description?: React.ReactNode;
    okText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    disabled?: boolean;
    children?: React.ReactElement;
  }
> = ({ title, description, okText = 'OK', cancelText = 'Cancel', onConfirm, onCancel, disabled, children }) => {
  const [open, setOpen] = React.useState(false);
  if (!children) return null;
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              onCancel?.();
              setOpen(false);
            }}
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm?.();
              setOpen(false);
            }}
          >
            {okText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ---------------------------------------------------------------------------
// Input

export { Input } from './primitives/input';
export type { AntdInputProps, InputRef, InputProps } from './primitives/input';

// ---------------------------------------------------------------------------
// Card / Popover

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    hoverable?: boolean;
    styles?: { body?: React.CSSProperties };
    bodyStyle?: React.CSSProperties;
    children?: React.ReactNode;
  }
>(function Card({ hoverable, className, style, styles, bodyStyle, onClick, children, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-(--grl-border-radius) border bg-card text-card-foreground shadow-xs',
        hoverable && 'cursor-pointer transition-colors hover:border-primary/50',
        className,
      )}
      style={style}
      onClick={onClick}
      {...rest}
    >
      <div className="p-4" style={{ ...bodyStyle, ...styles?.body }}>
        {children}
      </div>
    </div>
  );
});

export interface AntdPopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  content?: React.ReactNode;
  title?: React.ReactNode;
  trigger?: Array<'click' | 'hover' | 'contextMenu'> | 'click' | 'hover';
  placement?: string;
  destroyTooltipOnHide?: boolean;
  arrow?: boolean;
  overlayClassName?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const Popover: React.FC<AntdPopoverProps> = ({
  open,
  onOpenChange,
  content,
  children,
}) => (
  <UiPopover open={open} onOpenChange={onOpenChange}>
    <UiPopoverTrigger asChild>
      {React.isValidElement(children) ? children : <span className="inline-flex">{children}</span>}
    </UiPopoverTrigger>
    <UiPopoverContent>{content}</UiPopoverContent>
  </UiPopover>
);

// ---------------------------------------------------------------------------
// Tabs (items schema subset of antd)

export interface AntdTabsItemType {
  key: string;
  label: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items?: AntdTabsItemType[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  type?: 'line' | 'card' | 'editable-card';
  size?: 'large' | 'middle' | 'small';
  className?: string;
  rootClassName?: string;
  style?: React.CSSProperties;
  tabBarExtraContent?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  size,
  className,
  rootClassName,
  style,
  tabBarExtraContent,
}) => {
  const list = items ?? [];
  const [uncontrolled, setUncontrolled] = React.useState<string>(
    defaultActiveKey ?? list[0]?.key ?? '',
  );
  const current = activeKey ?? uncontrolled;

  const select = (key: string) => {
    if (activeKey === undefined) setUncontrolled(key);
    onChange?.(key);
  };

  return (
    <UiTabs value={current} onValueChange={select} style={style} className={cn(rootClassName, className)}>
      <div className="flex w-full items-center justify-between gap-2">
        <UiTabsList className={cn(size === 'small' && 'h-8')}>
          {list.map((item) => (
            <UiTabsTrigger key={item.key} value={item.key} disabled={item.disabled}>
              {item.label}
            </UiTabsTrigger>
          ))}
        </UiTabsList>
        {tabBarExtraContent}
      </div>
      {list.map((item) => (
        <UiTabsContent key={item.key} value={item.key}>
          {item.children}
        </UiTabsContent>
      ))}
    </UiTabs>
  );
};

// ---------------------------------------------------------------------------
// Checkbox

export { Checkbox } from './primitives/checkbox';
export type { AntdCheckboxChangeEvent } from './primitives/checkbox';

// ---------------------------------------------------------------------------
// Form (layout-only subset: values are injected into named Form.Item children)

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

// ---------------------------------------------------------------------------
// Switch

export { Switch } from './primitives/switch';
export type { AntdSwitchProps, SwitchProps } from './primitives/switch';

// ---------------------------------------------------------------------------
// Steps

export { Divider } from './primitives/divider';
export { Tag } from './primitives/tag';

export const Steps: React.FC<{
  current?: number;
  items?: Array<{ title?: React.ReactNode; description?: React.ReactNode }>;
}> = ({ current = 0, items = [] }) => (
  <div className="flex w-full items-center">
    {items.map((item, index) => {
      const state = index < current ? 'done' : index === current ? 'active' : 'pending';
      return (
        <React.Fragment key={index}>
          {index > 0 ? (
            <div className={cn('h-px flex-1', state === 'pending' ? 'bg-border' : 'bg-primary')} />
          ) : null}
          <div className="flex items-center gap-2 px-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                state === 'done' && 'bg-primary text-primary-foreground',
                state === 'active' && 'border-2 border-primary text-primary',
                state === 'pending' && 'border border-border text-muted-foreground',
              )}
            >
              {index + 1}
            </span>
            {item.title ? (
              <span
                className={cn(
                  'whitespace-nowrap text-xs',
                  state === 'pending' ? 'text-muted-foreground' : 'font-medium text-foreground',
                )}
              >
                {item.title}
              </span>
            ) : null}
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

export { Radio } from './primitives/radio';
export type { AntdRadioGroupProps, RadioGroupProps } from './primitives/radio';

// ---------------------------------------------------------------------------
// InputNumber / DatePicker / TimePicker

export { InputNumber } from './primitives/input-number';
export { DatePicker, TimePicker } from './primitives/date-picker';
export type { AntdDatePickerProps } from './primitives/date-picker';

// ---------------------------------------------------------------------------
// Space

export { Space } from './primitives/space';
export type { SpaceProps } from './primitives/space';

// ---------------------------------------------------------------------------
// Avatar

export { Avatar } from './primitives/avatar';

// ---------------------------------------------------------------------------
// Select (options schema subset of antd)

export { Select } from './primitives/select';
export type { AntdSelectOption, AntdSelectProps, SelectProps } from './primitives/select';

// ---------------------------------------------------------------------------
// Modal (Dialog-based subset of antd)

export const Modal: React.FC<{
  open?: boolean;
  title?: React.ReactNode;
  width?: number | string;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
  onOk?: () => void;
  onCancel?: () => void;
  footer?: React.ReactNode | null;
  destroyOnClose?: boolean;
  maskClosable?: boolean;
  centered?: boolean;
  closable?: boolean | Record<string, unknown>;
  okButtonProps?: { danger?: boolean; htmlType?: string; onClick?: () => void; form?: string; disabled?: boolean };
  bodyStyle?: React.CSSProperties;
  getContainer?: () => HTMLElement | false;
  children?: React.ReactNode;
  className?: string;
}> = ({
  open = false,
  title,
  width = 520,
  okText = 'OK',
  cancelText = 'Cancel',
  onOk,
  onCancel,
  footer,
  destroyOnClose = false,
  centered,
  children,
  className,
}) => {
  const body = destroyOnClose && !open ? null : children;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel?.();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn('w-full gap-0', centered && 'top-[50%]', className)}
        style={{ maxWidth: typeof width === 'number' ? `${width}px` : width }}
      >
        {title ? (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        ) : null}
        {body}
        {footer !== null ? (
          <DialogFooter className="mt-4">
            {footer ?? (
              <>
                <UiButton variant="outline" onClick={() => onCancel?.()}>
                  {cancelText}
                </UiButton>
                <UiButton onClick={() => onOk?.()}>{okText}</UiButton>
              </>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// App (imperative modal.confirm backed by an AlertDialog host)

export interface AntdConfirmOptions {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  content?: React.ReactNode;
  okText?: string;
  cancelText?: string;
  okButtonProps?: { danger?: boolean };
  onOk?: () => void;
  onCancel?: () => void;
}

interface ConfirmItem extends AntdConfirmOptions {
  id: number;
}

let confirmSeq = 0;
let confirmItems: ConfirmItem[] = [];
const confirmListeners = new Set<(items: ConfirmItem[]) => void>();

const emitConfirms = () => confirmListeners.forEach((listener) => listener(confirmItems));

const openConfirm = (options: AntdConfirmOptions) => {
  confirmItems = [...confirmItems, { ...options, id: ++confirmSeq }];
  emitConfirms();
};

const closeConfirm = (id: number) => {
  confirmItems = confirmItems.filter((item) => item.id !== id);
  emitConfirms();
};

interface AppContextValue {
  modal: { confirm: (options: AntdConfirmOptions) => void };
}

const AppContext = React.createContext<AppContextValue>({
  modal: { confirm: openConfirm },
});

const ConfirmHost: React.FC = () => {
  const [items, setItems] = React.useState<ConfirmItem[]>(confirmItems);
  React.useEffect(() => {
    confirmListeners.add(setItems);
    return () => {
      confirmListeners.delete(setItems);
    };
  }, []);

  return (
    <>
      {items.map((item) => (
        <AlertDialog key={item.id} defaultOpen>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{item.title}</AlertDialogTitle>
              {item.content ? <AlertDialogDescription asChild><div>{item.content}</div></AlertDialogDescription> : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  item.onCancel?.();
                  closeConfirm(item.id);
                }}
              >
                {item.cancelText ?? 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction
                variant={item.okButtonProps?.danger ? 'destructive' : 'default'}
                onClick={() => {
                  item.onOk?.();
                  closeConfirm(item.id);
                }}
              >
                {item.okText ?? 'OK'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}
    </>
  );
};

const AppProvider: React.FC<{ children?: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children,
  className,
  style,
}) => (
  <AppContext.Provider value={{ modal: { confirm: openConfirm } }}>
    <div className={cn('h-full', className)} style={style}>
      {children}
      <ConfirmHost />
    </div>
  </AppContext.Provider>
);

export const App = Object.assign(AppProvider, {
  useApp: (): AppContextValue => React.useContext(AppContext),
});
