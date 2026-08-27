import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { cn } from '@/lib/utils';

/** @deprecated antd-migration compat alias — use {@link ConfirmOptions} instead. */
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

type ConfirmGlobalState = {
  seq: number;
  items: ConfirmItem[];
  listeners: Set<(items: ConfirmItem[]) => void>;
};

/**
 * State lives on globalThis so dev-server HMR (which re-evaluates this
 * module) keeps pending confirms and live subscribers across reloads.
 */
const confirmState = ((globalThis as Record<string, unknown>).__JDM_CONFIRM_STATE ??= {
  seq: 0,
  items: [] as ConfirmItem[],
  listeners: new Set<(items: ConfirmItem[]) => void>(),
}) as ConfirmGlobalState;

const emitConfirms = () => confirmState.listeners.forEach((listener) => listener(confirmState.items));

const openConfirm = (options: AntdConfirmOptions) => {
  confirmState.items = [...confirmState.items, { ...options, id: ++confirmState.seq }];
  emitConfirms();
};

const closeConfirm = (id: number) => {
  confirmState.items = confirmState.items.filter((item) => item.id !== id);
  emitConfirms();
};

interface AppContextValue {
  modal: { confirm: (options: AntdConfirmOptions) => void };
}

const AppContext = React.createContext<AppContextValue>({
  modal: { confirm: openConfirm },
});

const ConfirmHost: React.FC = () => {
  const [items, setItems] = React.useState<ConfirmItem[]>(confirmState.items);
  React.useEffect(() => {
    confirmState.listeners.add(setItems);
    return () => {
      confirmState.listeners.delete(setItems);
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

/** Neutral name (antd-migration compat surface). */
export type ConfirmOptions = AntdConfirmOptions;
