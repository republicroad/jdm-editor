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

let confirmSeq = 0;
let confirmItems: ConfirmItem[] = [];
const confirmListeners = new Set<(items: ConfirmItem[]) => void>();

const emitConfirms = () => confirmListeners.forEach((listener) => listener(confirmItems));

const openConfirm = (options: AntdConfirmOptions) => {
  confirmItems = [...confirmItems, { ...options, id: ++confirmSeq }];
  emitConfirms();
};

const closeConfirm = (id: number) => {
  confirmItems = confirmItems.filter((item) => item.id !== id);
  emitConfirms();
};

interface AppContextValue {
  modal: { confirm: (options: AntdConfirmOptions) => void };
}

const AppContext = React.createContext<AppContextValue>({
  modal: { confirm: openConfirm },
});

const ConfirmHost: React.FC = () => {
  const [items, setItems] = React.useState<ConfirmItem[]>(confirmItems);
  React.useEffect(() => {
    confirmListeners.add(setItems);
    return () => {
      confirmListeners.delete(setItems);
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
