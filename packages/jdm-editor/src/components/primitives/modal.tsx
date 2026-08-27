import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button as UiButton } from '@/components/ui/button';

import { cn } from '@/lib/utils';

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
        className={cn(
          /*
           * Height contract: cap the dialog to the viewport and let ONLY the
           * body scroll, keeping the footer (OK/Cancel) reachable. Radix
           * DialogContent is `fixed top-1/2 -translate-y-1/2`, so without a
           * max-height tall content used to overflow both viewport edges —
           * the Map Excel Data panel was unreachable at its bottom buttons.
           */
          'grid grid-rows-[auto_minmax(0,1fr)_auto]',
          centered && 'top-[50%]',
          className,
        )}
        style={{
          maxWidth: typeof width === 'number' ? `${width}px` : width,
          maxHeight: 'calc(100dvh - 48px)',
          // Radix PORTALS mount under <body>, outside .grl-root, so the scoped
          // preflight (`:where(*) { box-sizing: border-box }`) never reaches
          // them and the shadcn template silently becomes content-box — maxHeight
          // then excludes its own p-6 padding (+48px overflow). Declare it here.
          // Registered as GRL-STYLE-HACK[HK-14]; systemic fix = portal scoping,
          // docs/shadcn-theming-roadmap.zh-CN.md §P3 + troubleshooting case #4.
          boxSizing: 'border-box',
        }}
      >
        {title ? (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        ) : null}
        {body ? <div className="min-h-0 overflow-y-auto">{body}</div> : null}
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
