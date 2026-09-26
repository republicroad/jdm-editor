import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CirclePlus,
  GripHorizontal,
  GripVertical,
  PinOff,
  Plus,
  Settings2,
} from 'lucide-react';
import React from 'react';

/**
 * Local stand-in for ReUI's IconPlaceholder (multi-library icon indirection).
 * The kernel renders lucide exclusively, so only the lucide prop is honored.
 */
const ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  ArrowDownIcon: ArrowDown,
  ArrowLeftIcon: ArrowLeft,
  ArrowLeftToLineIcon: ArrowLeftToLine,
  ArrowRightIcon: ArrowRight,
  ArrowRightToLineIcon: ArrowRightToLine,
  ArrowUpIcon: ArrowUp,
  CheckIcon: Check,
  ChevronLeftIcon: ChevronLeft,
  ChevronRightIcon: ChevronRight,
  ChevronsUpDownIcon: ChevronsUpDown,
  CirclePlusIcon: CirclePlus,
  GripHorizontalIcon: GripHorizontal,
  GripVerticalIcon: GripVertical,
  PinOffIcon: PinOff,
  PlusIcon: Plus,
  Settings2Icon: Settings2,
};

export const IconPlaceholder: React.FC<
  {
    lucide?: string;
    tabler?: string;
    hugeicons?: string;
    phosphor?: string;
    remixicon?: string;
  } & React.SVGProps<SVGSVGElement>
> = ({ lucide, ...props }) => {
  const Cmp = lucide ? ICONS[lucide] : undefined;
  if (!Cmp) {
    return null;
  }
  return <Cmp {...props} />;
};
