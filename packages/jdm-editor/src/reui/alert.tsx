import { cn } from '#lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';

/**
 * 本地化裁剪版（reui/alert 上游含 info/success/invert 等扩展色变体；kernel
 * 主题无对应扩展 token，裁到 kernel 实际使用的变体）。warning 无 token，
 * 按 kernel 既有 amber 工具类惯例构建（对齐 tab-custom-function-table 警告带）。
 */
const alertVariants = cva(
  [
    'relative w-full text-sm border has-[>svg]:grid-cols-[calc(var(--spacing)*3)_1fr] grid-cols-[0_1fr] grid gap-y-0.5 items-center [&>svg:not([class*=size-])]:size-4',
    'has-[>[data-slot=alert-title]+[data-slot=alert-description]]:items-start',
    'has-[>[data-slot=alert-title]+[data-slot=alert-description]]:[&_svg]:translate-y-0.5',
    'rounded-lg px-3 py-2.5 has-[>svg]:gap-x-2.5',
  ],
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive: 'border-destructive/30 bg-destructive/4 [&>svg]:text-destructive',
        warning: 'border-amber-500/30 bg-amber-500/10 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot='alert' role='alert' className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-title'
      className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-description'
      className={cn(
        'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='alert-action'
      className={cn(
        'flex gap-1.5 max-sm:col-start-2 max-sm:mt-2 max-sm:justify-start sm:col-start-3 sm:row-start-1 sm:justify-end sm:self-center',
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
