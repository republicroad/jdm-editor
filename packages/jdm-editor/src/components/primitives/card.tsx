import { cn } from '#lib/utils';
import * as React from 'react';

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
      <div className='p-4' style={{ ...bodyStyle, ...styles?.body }}>
        {children}
      </div>
    </div>
  );
});
