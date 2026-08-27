/**
 * JDM UI primitives.
 *
 * Thin, antd-shaped wrappers around the local shadcn/ui components so the
 * editor codebase keeps a small, consistent component surface. Import from
 * here instead of pulling UI libraries directly into feature modules.
 *
 * This file is a barrel: each component lives in its own module under
 * `./primitives/` and is re-exported here unchanged.
 */
export { App } from './primitives/app';
export type { AntdConfirmOptions } from './primitives/app';

export { Avatar } from './primitives/avatar';

export { Button } from './primitives/button';
export type { AntdButtonProps, ButtonProps } from './primitives/button';

export { Card } from './primitives/card';

export { Checkbox } from './primitives/checkbox';
export type { AntdCheckboxChangeEvent } from './primitives/checkbox';

export { DatePicker, TimePicker } from './primitives/date-picker';
export type { AntdDatePickerProps } from './primitives/date-picker';

export { Divider } from './primitives/divider';

export { Dropdown } from './primitives/dropdown';
export type { AntdMenuItemType, AntdMenuProps, MenuProps } from './primitives/dropdown';

export { Form } from './primitives/form';
export type { FormProps } from './primitives/form';

export { Input } from './primitives/input';
export type { AntdInputProps, InputRef, InputProps } from './primitives/input';

export { InputNumber } from './primitives/input-number';

export { Modal } from './primitives/modal';

export { Popconfirm } from './primitives/popconfirm';

export { Popover } from './primitives/popover';
export type { AntdPopoverProps } from './primitives/popover';

export { Radio } from './primitives/radio';
export type { AntdRadioGroupProps, RadioGroupProps } from './primitives/radio';

export { Select } from './primitives/select';
export type { AntdSelectOption, AntdSelectProps, SelectProps } from './primitives/select';

export { Space } from './primitives/space';
export type { SpaceProps } from './primitives/space';

export { Spin } from './primitives/spin';

export { Steps } from './primitives/steps';

export { Switch } from './primitives/switch';
export type { AntdSwitchProps, SwitchProps } from './primitives/switch';

export { Tabs } from './primitives/tabs';
export type { AntdTabsItemType, TabsProps } from './primitives/tabs';

export { Tag } from './primitives/tag';

export { Tooltip } from './primitives/tooltip';

export { Typography } from './primitives/typography';
export type { ConfirmOptions } from './primitives/app';
export type { CheckboxChangeEvent } from './primitives/checkbox';
export type { DatePickerProps } from './primitives/date-picker';
export type { MenuItemType } from './primitives/dropdown';
export type { PopoverProps } from './primitives/popover';
export type { SelectOption } from './primitives/select';
export type { TabsItemType } from './primitives/tabs';
