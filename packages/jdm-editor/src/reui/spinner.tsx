import { cn } from '#lib/utils';
import { LoaderCircleIcon } from 'lucide-react';

/** 加载指示（reui/spinner API 面：size 经 className 传）；async 钻取态用。 */
function Spinner({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span data-slot='spinner' className={cn('inline-flex shrink-0 items-center justify-center', className)} {...props}>
      <LoaderCircleIcon className='size-full animate-spin' />
    </span>
  );
}

export { Spinner };
