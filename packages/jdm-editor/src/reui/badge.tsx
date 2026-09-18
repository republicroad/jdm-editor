import { cn } from '#lib/utils';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { type VariantProps, cva } from 'class-variance-authority';

// 本地化裁剪版（reui/badge 上游含 20+ 扩展色变体；kernel 主题无 info/success 等
// 扩展 token，且 tailwind 会把 cva 字面量类全量产出——裁到 kernel 实际使用的变体，
// 保住 style.css 预算。需要新变体时从 appshell 的 reui/badge.tsx 拷贝单个变体。）
const badgeVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center w-fit border border-transparent font-medium whitespace-nowrap outline-none transition-shadow',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        outline: 'border-border bg-transparent dark:bg-input/32',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive text-white',
      },
      size: {
        xs: 'px-1 py-0.25 text-[0.6rem] leading-none h-4 min-w-4 gap-1',
        sm: 'px-1 py-0.25 text-[0.625rem] leading-none h-4.5 min-w-4.5 gap-1',
        default: 'px-1.25 py-0.5 text-xs h-5 min-w-5 gap-1',
        lg: 'px-1.5 py-0.5 text-xs h-5.5 min-w-5.5 gap-1',
        xl: 'px-2 py-0.75 text-sm h-6 min-w-6 gap-1.5',
      },
      /** `default`: active style radius. `full`: pill radius. */
      radius: {
        default: 'rounded-sm',
        full: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      radius: 'default',
    },
  },
);

interface BadgeProps extends useRender.ComponentProps<'span'> {
  variant?: VariantProps<typeof badgeVariants>['variant'];
  size?: VariantProps<typeof badgeVariants>['size'];
  radius?: VariantProps<typeof badgeVariants>['radius'];
}

function Badge({ className, variant, size, radius, render, ...props }: BadgeProps) {
  const defaultProps = {
    'data-slot': 'badge',
    'className': cn(badgeVariants({ variant, size, radius, className })),
  };

  return useRender({
    defaultTagName: 'span',
    render,
    props: mergeProps<'span'>(defaultProps, props),
  });
}

export { Badge, badgeVariants, type BadgeProps };
