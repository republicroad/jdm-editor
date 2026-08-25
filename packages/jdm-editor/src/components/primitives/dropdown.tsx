import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface AntdMenuItemType {
  key?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  type?: 'divider' | 'group';
  onClick?: (info: { key: string }) => void;
  children?: AntdMenuItemType[];
}

export interface AntdMenuProps {
  items?: AntdMenuItemType[];
  onClick?: (info: { key: string }) => void;
}

export type MenuProps = AntdMenuProps;

const MenuItemsRenderer: React.FC<{ items?: AntdMenuItemType[]; onClick?: AntdMenuProps['onClick'] }> = ({
  items,
  onClick,
}) =>
  items?.map((item, index) => {
    const itemKey = item.key ?? String(index);
    const handleSelect = () => (item.onClick ?? onClick)?.({ key: itemKey });
    return item.type === 'divider' ? (
      <DropdownMenuSeparator key={itemKey} />
    ) : item.children?.length ? (
      <DropdownMenuSub key={itemKey}>
        <DropdownMenuSubTrigger disabled={item.disabled}>{item.label}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <MenuItemsRenderer items={item.children} onClick={onClick} />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    ) : (
      <DropdownMenuItem
        key={itemKey}
        disabled={item.disabled}
        variant={item.danger ? 'destructive' : 'default'}
        onSelect={handleSelect}
      >
        {item.icon}
        {item.label}
      </DropdownMenuItem>
    );
  }) ?? null;

export const Dropdown: React.FC<{
  menu?: AntdMenuProps;
  trigger?: Array<'click' | 'hover' | 'contextMenu'>;
  placement?: string;
  arrow?: boolean;
  overlayStyle?: React.CSSProperties;
  destroyPopupOnHide?: boolean;
  transitionName?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}> = ({ menu, children }) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      {React.isValidElement(children) ? (
        children
      ) : (
        <span className="inline-flex cursor-pointer items-center">{children}</span>
      )}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <MenuItemsRenderer items={menu?.items} onClick={menu?.onClick} />
    </DropdownMenuContent>
  </DropdownMenu>
);
