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
import * as React from 'react';

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
      {/*
       * Real-DOM wrapper for the trigger: Radix `asChild` (Slot) only clones
       * handlers onto its direct child. Non-DOM children (e.g. a Tooltip
       * context wrapping the actual Button — see ImportColumnRow in
       * dt-excel-dialog) made clicks vanish before reaching the dialog.
       */}
      <AlertDialogTrigger asChild disabled={disabled}>
        <span className='inline-flex'>{children}</span>
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
