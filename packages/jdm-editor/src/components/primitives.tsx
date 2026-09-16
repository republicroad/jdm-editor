/**
 * JDM UI primitives.
 *
 * Thin wrappers around the local shadcn/ui components so the editor codebase
 * keeps a small, consistent component surface. Import from here instead of
 * pulling UI libraries directly into feature modules.
 *
 * This file is a barrel: each component lives in its own module under
 * `./primitives/` and is re-exported here unchanged.
 */
export { App } from './primitives/app';
export type { ConfirmOptions } from './primitives/app';

export { Avatar } from './primitives/avatar';

export { Button } from './primitives/button';
export type { ButtonProps } from './primitives/button';

export { Card } from './primitives/card';

export { Checkbox } from './primitives/checkbox';
export type { CheckboxChangeEvent } from './primitives/checkbox';

export { DatePicker, TimePicker } from './primitives/date-picker';
export type { DatePickerProps } from './primitives/date-picker';

export { Divider } from './primitives/divider';

export { Dropdown } from './primitives/dropdown';
export type { MenuItemType, MenuProps } from './primitives/dropdown';

export { Form } from './primitives/form';
export type { FormProps } from './primitives/form';

export { Input } from './primitives/input';
export type { InputRef, InputProps } from './primitives/input';

export { InputNumber } from './primitives/input-number';

export { Modal } from './primitives/modal';

export { Popconfirm } from './primitives/popconfirm';

export { Popover } from './primitives/popover';
export type { PopoverProps } from './primitives/popover';

export { Radio } from './primitives/radio';
export type { RadioGroupProps } from './primitives/radio';

export { Select } from './primitives/select';
export type { SelectOption, SelectProps } from './primitives/select';

export { Space } from './primitives/space';
export type { SpaceProps } from './primitives/space';

export { Spin } from './primitives/spin';

export { Steps } from './primitives/steps';

export { Switch } from './primitives/switch';
export type { SwitchProps } from './primitives/switch';

export { Tabs } from './primitives/tabs';
export type { TabsItemType, TabsProps } from './primitives/tabs';

export { Tag } from './primitives/tag';

export { Tooltip } from './primitives/tooltip';

export { Typography } from './primitives/typography';
