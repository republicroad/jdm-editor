import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  MinusIcon,
  RotateCwIcon,
  XIcon,
} from 'lucide-react';
import type { ComponentProps } from 'react';

/**
 * 上游 reui create-app 的 IconPlaceholder 垫片：按 lucide prop 名取图标，
 * 保存 vendored 调用点零改动（移植裁剪的接缝件）。
 */
const ICONS = {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  MinusIcon,
  RotateCwIcon,
  XIcon,
} as const;

export function IconPlaceholder({
  lucide,
  // 上游调用点携带全图标集名字（tabler/hugeicons/phosphor/remixicon）——吞掉

  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  ...props
}: {
  lucide: keyof typeof ICONS;
} & Record<string, unknown> &
  Omit<ComponentProps<(typeof ICONS)['ChevronRightIcon']>, 'ref'>) {
  const Icon = ICONS[lucide] ?? ChevronRightIcon;
  return <Icon {...(props as ComponentProps<typeof ChevronRightIcon>)} />;
}
