import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import * as React from 'react';

/** @deprecated antd-migration compat alias — use {@link MenuItemType} instead. */
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

/** @deprecated antd-migration compat alias — use {@link MenuProps} instead. */
export interface AntdMenuProps {
  items?: AntdMenuItemType[];
  onClick?: AntdMenuItemType['onClick'];
}

export type MenuProps = AntdMenuProps;

type MenuPrimitiveSet = {
  Item: typeof DropdownMenuItem | typeof ContextMenuItem;
  Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator;
  // Radix `Sub` variants are providers without refs and come from different
  // menu implementations, so keep this slot loosely typed.
  Sub: React.ElementType;
  SubTrigger: typeof DropdownMenuSubTrigger | typeof ContextMenuSubTrigger;
  SubContent: typeof DropdownMenuSubContent | typeof ContextMenuSubContent;
};

const renderMenuItems = (
  items: AntdMenuItemType[] | undefined,
  onClick: AntdMenuProps['onClick'],
  P: MenuPrimitiveSet,
): React.ReactNode =>
  // Callers build item arrays with conditional expressions and may leave null
  // entries behind; drop them before touching item.key.
  (items ?? [])
    .filter((item): item is AntdMenuItemType => !!item)
    .map((item, index) => {
      const itemKey = item.key ?? String(index);
      const handleSelect = () => (item.onClick ?? onClick)?.({ key: itemKey });
      return item.type === 'divider' ? (
        <P.Separator key={itemKey} />
      ) : item.children?.length ? (
        <P.Sub key={itemKey}>
          <P.SubTrigger disabled={item.disabled}>{item.label}</P.SubTrigger>
          <P.SubContent>{renderMenuItems(item.children, onClick, P)}</P.SubContent>
        </P.Sub>
      ) : (
        <P.Item
          key={itemKey}
          disabled={item.disabled}
          variant={item.danger ? 'destructive' : 'default'}
          onSelect={handleSelect}
        >
          {item.icon}
          {item.label}
        </P.Item>
      );
    }) ?? null;

const dropdownPrimitives: MenuPrimitiveSet = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

const contextMenuPrimitives: MenuPrimitiveSet = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

const usesContextMenuTrigger = (trigger: Array<'click' | 'hover' | 'contextMenu'> | undefined) =>
  Array.isArray(trigger) && trigger.includes('contextMenu');

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
}> = ({ menu, trigger, children }) => {
  const wrappedChildren = React.isValidElement(children) ? (
    children
  ) : (
    <span className='inline-flex cursor-pointer items-center'>{children}</span>
  );

  if (usesContextMenuTrigger(trigger)) {
    return (
      <ContextMenu modal={false}>
        <ContextMenuTrigger asChild>{wrappedChildren}</ContextMenuTrigger>
        <ContextMenuContent>{renderMenuItems(menu?.items, menu?.onClick, contextMenuPrimitives)}</ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{wrappedChildren}</DropdownMenuTrigger>
      <DropdownMenuContent align='start'>
        {renderMenuItems(menu?.items, menu?.onClick, dropdownPrimitives)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** Neutral name (antd-migration compat surface). */
export type MenuItemType = AntdMenuItemType;
