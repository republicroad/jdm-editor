/**
 * Antd-compatible adapters over the shadcn/ui primitives.
 *
 * Decision-graph (and later modules) migrate off antd incrementally by
 * swapping `from 'antd'` for `from '../antd-compat'` (path varies). The
 * exported surface mirrors the antd APIs that are actually used inside
 * this library — nothing more. This module is scaffolding for Stage C/D
 * and gets deleted once the last consumer is gone.
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
import { Button as UiButton } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { DropdownMenuSub } from '@/components/ui/dropdown-menu';
import { DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input as UiInput } from '@/components/ui/input';
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
}

export const Button: React.FC<AntdButtonProps> = ({
  type = 'default',
  icon,
  danger = false,
  loading = false,
  size = 'middle',
  block = false,
  shape,
  className,
  children,
  disabled,
  ...rest
}) => {
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

  return (
    <UiButton
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
};

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
    children?: React.ReactElement;
  }
> = ({ title, placement = 'top', children }) => {
  if (!title || !children) {
    return <>{children}</>;
  }
  return (
    <UiTooltipProvider delayDuration={200}>
      <UiTooltipRoot>
        <UiTooltipTrigger asChild>{children}</UiTooltipTrigger>
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
  disabled?: boolean;
  children?: React.ReactElement;
}> = ({ menu, children }) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
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

export const Input: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
    size?: 'large' | 'middle' | 'small';
    allowClear?: boolean;
    bordered?: boolean;
  }
> = ({ size, allowClear = false, bordered = true, value, onChange, className, disabled, ...rest }) => {
  const [internal, setInternal] = React.useState('');
  const current = value !== undefined ? String(value) : internal;

  const sizeClass =
    size === 'large' ? 'h-10 text-base' : size === 'small' ? 'h-8 text-xs' : undefined;

  return (
    <div className="relative inline-flex w-full items-center">
      <UiInput
        value={current}
        onChange={(event) => {
          setInternal(event.target.value);
          onChange?.(event as never);
        }}
        disabled={disabled}
        className={cn(sizeClass, !bordered && 'border-0 shadow-none', allowClear && 'pr-7', className)}
        {...rest}
      />
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
};

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
// Space

export const Space: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    size?: number | [number, number];
    direction?: 'horizontal' | 'vertical';
  }
> = ({ size = 8, direction = 'horizontal', className, style, ...rest }) => {
  const gap = Array.isArray(size) ? `${size[1]}px ${size[0]}px` : `${size}px`;
  return (
    <div
      className={cn(direction === 'vertical' ? 'flex flex-col' : 'flex flex-row items-center', className)}
      style={{ gap, ...style }}
      {...rest}
    />
  );
};

// ---------------------------------------------------------------------------
// Avatar

export const Avatar: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    src?: string;
    alt?: string;
    size?: number;
    shape?: 'circle' | 'square';
  }
> = ({ src, alt, size = 32, shape = 'circle', className, style, children, ...rest }) => (
  <div
    className={cn(
      'flex shrink-0 select-none items-center justify-center overflow-hidden bg-muted text-xs font-medium text-muted-foreground',
      shape === 'circle' ? 'rounded-full' : 'rounded-md',
      className,
    )}
    style={{ width: size, height: size, ...style }}
    {...rest}
  >
    {src ? <img src={src} alt={alt} className="size-full object-cover" /> : children}
  </div>
);
