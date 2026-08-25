import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button as UiButton } from '@/components/ui/button';

import { cn } from '@/lib/utils';

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
