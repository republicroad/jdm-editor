import { cn } from '#lib/utils';
import { LoaderCircle } from 'lucide-react';
import * as React from 'react';

export const Spinner: React.FC<React.ComponentProps<typeof LoaderCircle>> = ({ className, ...props }) => (
  <LoaderCircle role='status' aria-label='Loading' className={cn('size-4 animate-spin', className)} {...props} />
);
