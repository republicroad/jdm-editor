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
import { Checkbox as UiCheckbox } from '@/components/ui/checkbox';
import { Switch as UiSwitch } from '@/components/ui/switch';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { DropdownMenuSub } from '@/components/ui/dropdown-menu';
import { DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input as UiInput } from '@/components/ui/input';
import {
  Popover as UiPopover,
  PopoverContent as UiPopoverContent,
  PopoverTrigger as UiPopoverTrigger,
} from '@/components/ui/popover';
import {
  Select as SelectPrimitiveRoot,
  SelectContent as SelectPrimitiveContent,
  SelectItem as SelectPrimitiveItem,
  SelectTrigger as SelectPrimitiveTrigger,
  SelectValue as SelectPrimitiveValue,
} from '@/components/ui/select';
import { Tabs as UiTabs } from '@/components/ui/tabs';
import { TabsContent as UiTabsContent } from '@/components/ui/tabs';
import { TabsList as UiTabsList } from '@/components/ui/tabs';
import { TabsTrigger as UiTabsTrigger } from '@/components/ui/tabs';
import { Tooltip as UiTooltipRoot } from '@/components/ui/tooltip';
import { TooltipContent as UiTooltipContent } from '@/components/ui/tooltip';
import { TooltipProvider as UiTooltipProvider } from '@/components/ui/tooltip';
import { TooltipTrigger as UiTooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import dayjs, { type Dayjs } from 'dayjs';

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

export const Spin: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    size?: 'large' | 'default' | 'small';
    spinning?: boolean;
    children?: React.ReactNode;
  }
> = ({ size = 'default', spinning = true, children, className, style, ...rest }) => {
  const spinnerClass =
    size === 'large' ? 'size-8' : size === 'small' ? 'size-4' : 'size-6';

  if (!children) {
    return (
      <div role="status" className={cn('flex w-full items-center justify-center p-2', className)} style={style} {...rest}>
        <Loader2 className={cn('animate-spin text-muted-foreground', spinnerClass)} />
      </div>
    );
  }

  if (!spinning) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)} style={style} {...rest}>
      {children}
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-(--grl-border-radius) bg-background/60">
        <Loader2 className={cn('animate-spin text-muted-foreground', spinnerClass)} />
      </div>
    </div>
  );
};

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

export interface AntdInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix' | 'suffix'> {
  size?: 'large' | 'middle' | 'small';
  allowClear?: boolean;
  bordered?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, AntdInputProps>(function Input(
  { size, allowClear = false, bordered = true, prefix, suffix, value, onChange, className, disabled, ...rest },
  ref,
) {
  const [internal, setInternal] = React.useState('');
  const current = value !== undefined ? String(value) : internal;

  const sizeClass =
    size === 'large' ? 'h-10 text-base' : size === 'small' ? 'h-8 text-xs' : undefined;

  return (
    <div className="relative inline-flex w-full items-center">
      {prefix ? <span className="absolute left-2.5 flex text-muted-foreground [&_svg]:size-3.5">{prefix}</span> : null}
      <UiInput
        ref={ref}
        value={current}
        onChange={(event) => {
          setInternal(event.target.value);
          onChange?.(event as never);
        }}
        disabled={disabled}
        className={cn(sizeClass, !bordered && 'border-0 shadow-none', allowClear && 'pr-7', prefix && 'pl-7', suffix && 'pr-8', className)}
        {...rest}
      />
      {suffix ? <span className="absolute right-2 flex text-muted-foreground [&_svg]:size-3.5">{suffix}</span> : null}
      {allowClear && current ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => {
            setInternal('');
            if (onChange) {
              const event = { target: { value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>;
              onChange(event);
            }
          }}
          className="absolute right-2 flex size-4 items-center justify-center rounded-full bg-muted-foreground/30 text-[10px] leading-none text-background hover:bg-muted-foreground/50"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
});

export type InputRef = HTMLInputElement;

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

export type InputProps = React.ComponentProps<typeof Input>;

export type SelectProps = AntdSelectProps;
export type SpaceProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: number | [number, number] | 'small' | 'middle' | 'large';
  direction?: 'horizontal' | 'vertical';
  wrap?: boolean;
};

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

export interface AntdCheckboxChangeEvent {
  target: { checked: boolean };
  stopPropagation: () => void;
}

export const Checkbox: React.FC<{
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onChange?: (event: AntdCheckboxChangeEvent) => void;
  children?: React.ReactNode;
}> = ({ checked, defaultChecked, disabled, className, style, onChange, children }) => (
  <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', className)} style={style}>
    <UiCheckbox
      checked={checked === undefined ? undefined : !!checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={(next) => onChange?.({ target: { checked: next === true }, stopPropagation: () => {} })}
    />
    {children ? <span>{children}</span> : null}
  </label>
);

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

export interface AntdSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  size?: 'default' | 'small';
  className?: string;
  style?: React.CSSProperties;
  onChange?: (checked: boolean) => void;
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
}

export const Switch: React.FC<AntdSwitchProps> = ({
  checked,
  defaultChecked,
  disabled,
  size,
  className,
  style,
  onChange,
}) => (
  <UiSwitch
    checked={checked === undefined ? undefined : !!checked}
    defaultChecked={defaultChecked}
    disabled={disabled}
    onCheckedChange={(next) => onChange?.(next === true)}
    className={cn(size === 'small' && 'data-[state=checked]:translate-x-3.5 h-4 w-7 [&_span]:size-3', className)}
    style={style}
  />
);

export type SwitchProps = AntdSwitchProps;

// ---------------------------------------------------------------------------
// Divider / Tag / Steps / Radio

export const Divider: React.FC<{
  type?: 'horizontal' | 'vertical';
  className?: string;
  style?: React.CSSProperties;
}> = ({ type = 'horizontal', className, style }) => (
  <div
    role="separator"
    className={cn(
      type === 'vertical' ? 'mx-1.5 inline-block h-[1.2em] w-px self-center bg-border' : 'my-2 w-full border-t border-border',
      className,
    )}
    style={style}
  />
);

export const Tag: React.FC<{
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ className, style, children }) => (
  <span
    className={cn('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs', className)}
    style={style}
  >
    {children}
  </span>
);

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

interface RadioContextValue {
  value?: string | number | boolean;
  setValue: (value: string | number | boolean) => void;
}

const RadioContext = React.createContext<RadioContextValue>({ setValue: () => {} });

const RadioGroupRoot: React.FC<{
  value?: string | number | boolean;
  size?: 'large' | 'middle' | 'small';
  disabled?: boolean;
  buttonStyle?: string;
  onChange?: (event: { target: { value: unknown } }) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ value, disabled, onChange, className, style, children }) => {
  const context = React.useMemo<RadioContextValue>(
    () => ({
      value,
      setValue: (next) => {
        if (!disabled) onChange?.({ target: { value: next } });
      },
    }),
    [value, disabled, onChange],
  );

  return (
    <RadioContext.Provider value={context}>
      <div
        role="radiogroup"
        className={cn(
          'inline-flex rounded-md border bg-muted p-0.5',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
        style={style}
      >
        {children}
      </div>
    </RadioContext.Provider>
  );
};

const RadioButton: React.FC<{
  value?: string | number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ value, disabled, className, style, children }) => {
  const { value: current, setValue } = React.useContext(RadioContext);
  const active = current !== undefined && String(current) === String(value);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setValue(value!)}
      className={cn(
        'flex-1 whitespace-nowrap rounded-[4px] px-3 py-1 text-xs transition-colors',
        active ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      style={style}
    >
      {children}
    </button>
  );
};

const RadioItem: React.FC<{
  value?: string | number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ value, disabled, className, style, children }) => {
  const { value: current, setValue } = React.useContext(RadioContext);
  const active = current !== undefined && String(current) === String(value);
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-1.5 text-sm',
        active ? 'text-primary' : 'text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      style={style}
      onClick={() => {
        if (!disabled) setValue(value!);
      }}
    >
      <span
        className={cn(
          'flex size-3.5 items-center justify-center rounded-full border transition-colors',
          active ? 'border-primary' : 'border-input',
        )}
      >
        {active ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      {children}
    </label>
  );
};

export const Radio = Object.assign(RadioItem, { Group: RadioGroupRoot, Button: RadioButton });

export interface AntdRadioGroupProps {
  value?: string | number | boolean;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  options?: Array<{ label?: React.ReactNode; value: string | number; disabled?: boolean }>;
  onChange?: (event: { target: { value: unknown } }) => void;
  className?: string;
  style?: React.CSSProperties;
}

export type RadioGroupProps = AntdRadioGroupProps;

// ---------------------------------------------------------------------------
// InputNumber / DatePicker / TimePicker

const borderlessInputClass =
  'h-7 rounded-md bg-transparent px-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

export const InputNumber: React.FC<{
  value?: number | null;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  controls?: boolean;
  variant?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onChange?: (value: number | null) => void;
}> = ({ value, min, max, step, disabled, size, placeholder, className, style, onChange }) => (
  <input
    type="number"
    value={value === undefined || value === null ? '' : value}
    min={min}
    max={max}
    step={step}
    placeholder={placeholder}
    disabled={disabled}
    onChange={(event) =>
      onChange?.(event.target.value === '' ? null : Number(event.target.value))
    }
    className={cn(
      borderlessInputClass,
      size === 'large' ? 'h-10 text-base' : undefined,
      'w-full rounded-md border border-input shadow-xs focus-visible:border-ring',
      className,
    )}
    style={style}
  />
);

export interface AntdDatePickerProps {
  value?: Dayjs | null;
  onChange?: (date: Dayjs | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
  size?: 'large' | 'middle' | 'small';
  variant?: string;
  format?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

const toDayjs = (raw: string) => dayjs(raw);

export const DatePicker: React.FC<AntdDatePickerProps> = ({
  value,
  onChange,
  disabled,
  allowClear = true,
  className,
  style,
  placeholder,
}) => (
  <input
    type="date"
    value={value?.format ? value.format('YYYY-MM-DD') : ''}
    placeholder={placeholder}
    disabled={disabled}
    onChange={(event) => {
      if (!event.target.value) {
        if (allowClear) onChange?.(null);
        return;
      }
      const parsed = toDayjs(event.target.value);
      if (parsed.isValid()) onChange?.(parsed);
    }}
    className={cn(
      borderlessInputClass,
      'w-full rounded-md border border-input shadow-xs focus-visible:border-ring',
      className,
    )}
    style={style}
  />
);

export const TimePicker: React.FC<AntdDatePickerProps> = ({
  value,
  onChange,
  disabled,
  allowClear = true,
  className,
  style,
}) => (
  <input
    type="time"
    value={value?.format ? value.format('HH:mm') : ''}
    disabled={disabled}
    onChange={(event) => {
      if (!event.target.value) {
        if (allowClear) onChange?.(null);
        return;
      }
      const parsed = toDayjs(`2000-01-01 ${event.target.value}`);
      if (parsed.isValid()) onChange?.(parsed);
    }}
    className={cn(
      borderlessInputClass,
      'w-full rounded-md border border-input shadow-xs focus-visible:border-ring',
      className,
    )}
    style={style}
  />
);

// ---------------------------------------------------------------------------
// Space

export const Space: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    size?: number | [number, number] | 'small' | 'middle' | 'large';
    direction?: 'horizontal' | 'vertical';
    wrap?: boolean;
  }
> = ({ size = 8, direction = 'horizontal', wrap, className, style, ...rest }) => {
  const resolved =
    size === 'small' ? 8 : size === 'middle' ? 16 : size === 'large' ? 24 : size;
  const gap = Array.isArray(resolved) ? `${resolved[1]}px ${resolved[0]}px` : `${resolved}px`;
  return (
    <div
      className={cn(
        direction === 'vertical' ? 'flex flex-col' : 'flex flex-row items-center',
        wrap && (direction === 'vertical' ? '' : 'flex-wrap'),
        className,
      )}
      style={{ gap, ...style }}
      {...rest}
    />
  );
};

// ---------------------------------------------------------------------------
// Avatar

export const Avatar: React.FC<
  Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
    src?: string;
    alt?: string;
    size?: number | 'large' | 'default' | 'small';
    shape?: 'circle' | 'square';
    icon?: React.ReactNode;
    children?: React.ReactNode;
  }
> = ({ src, alt, size = 'default', shape = 'circle', className, style, children, icon, ...rest }) => {
  const pxSize = typeof size === 'number' ? size : size === 'large' ? 40 : size === 'small' ? 24 : 32;
  return (
    <div
      className={cn(
        'flex shrink-0 select-none items-center justify-center overflow-hidden bg-muted text-xs font-medium text-muted-foreground',
        shape === 'circle' ? 'rounded-full' : 'rounded-md',
        className,
      )}
      style={{ width: pxSize, height: pxSize, ...style }}
      {...rest}
    >
      {src ? <img src={src} alt={alt} className="size-full object-cover" /> : children ?? icon}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Select (options schema subset of antd)

export interface AntdSelectOption {
  /** Optional metadata used by the excel-import dialogs */
  id?: string;
  type?: string;
  wrapInQuotes?: boolean;
  /** Extra render node shown in the dropdown list */
  display?: React.ReactNode;
  label?: React.ReactNode;
  value: string | number | boolean;
  disabled?: boolean;
}

export interface AntdSelectProps {
  options?: AntdSelectOption[];
  value?: string | number | boolean | Array<string | number>;
  defaultValue?: string | number | boolean | Array<string | number>;
  
  onChange?: (value: any, option?: AntdSelectOption) => void;
  onSelect?: (value: string | number | boolean, option: AntdSelectOption) => void;
  dropdownRender?: (menu: React.ReactNode) => React.ReactNode;
  optionRender?: (option: { data: AntdSelectOption }) => React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  allowClear?: boolean;
  onClear?: () => void;
  optionLabelProp?: string;
  loading?: boolean;
  showSearch?: boolean;
  filterOption?: boolean | ((input: string, option: AntdSelectOption) => boolean);
  mode?: 'multiple' | 'tags';
  variant?: string;
  suffixIcon?: React.ReactNode;
  popupMatchSelectWidth?: boolean | number;
  tokenSeparators?: string[];
  maxCount?: number;
  overlayClassName?: string;
  needConfirm?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Select: React.FC<AntdSelectProps> = ({
  options,
  value,
  defaultValue,
  onChange,
  onSelect,
  onClear,
  dropdownRender,
  optionRender,
  placeholder,
  disabled,
  size,
  allowClear,
  loading,
  mode,
  tokenSeparators: _tokenSeparators,
  suffixIcon: _suffixIcon,
  popupMatchSelectWidth: _popupMatchSelectWidth,
  variant: _variant,
  showSearch: _showSearch,
  filterOption: _filterOption,
  optionLabelProp: _optionLabelProp,
  maxCount: _maxCount,
  className,
  style,
}) => {
  const list = options ?? [];
  const current = value === undefined || value === null ? undefined : String(value);
  const selected = list.find((option) => String(option.value) === current);

  if (mode === 'multiple' || mode === 'tags') {
    const arrayValue = Array.isArray(value) ? (value as Array<string | number>) : [];
    return (
      <input
        value={arrayValue.join(', ')}
        placeholder={placeholder}
        disabled={disabled || loading}
        onChange={(event) =>
          onChange?.(
            event.target.value
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean),
          )
        }
        className={cn(borderlessInputClass, 'w-full rounded-md border border-input shadow-xs', className)}
        style={style}
      />
    );
  }

  const menu = (
    <>
      {list.map((option) => (
        <SelectPrimitiveItem
          key={String(option.value)}
          value={String(option.value)}
          disabled={option.disabled}
        >
          {optionRender ? optionRender({ data: option }) : (option.label ?? String(option.value))}
        </SelectPrimitiveItem>
      ))}
    </>
  );

  return (
    <div className="relative inline-flex w-full items-center">
      <SelectPrimitiveRoot
        value={current}
        defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
        onValueChange={(next) => {
          if (allowClear && next === current) return;
          const option = list.find((item) => String(item.value) === next) ?? ({} as AntdSelectOption);
          onSelect?.(next, option);
          onChange?.(next, option);
        }}
        disabled={disabled || loading}
      >
        <SelectPrimitiveTrigger
          className={cn(
            'w-full justify-between',
            size === 'large' ? 'h-10 text-base' : size === 'small' ? 'h-8 text-xs' : undefined,
            allowClear && !!current && '[&>svg:last-child]:hidden',
            className,
          )}
          style={style}
        >
          <SelectPrimitiveValue>
            {selected?.label ?? (placeholder ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : null)}
          </SelectPrimitiveValue>
        </SelectPrimitiveTrigger>
        <SelectPrimitiveContent position="popper">
          {dropdownRender ? dropdownRender(menu) : menu}
        </SelectPrimitiveContent>
      </SelectPrimitiveRoot>
      {allowClear && current ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => {
            onClear?.();
            onChange?.('', undefined);
          }}
          className="absolute right-7 flex size-3.5 items-center justify-center rounded-full bg-muted-foreground/30 text-[10px] leading-none text-background hover:bg-muted-foreground/50"
        >
          �?        </button>
      ) : null}
    </div>
  );
};

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
