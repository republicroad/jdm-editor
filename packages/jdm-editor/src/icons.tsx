/**
 * Internal icon layer.
 *
 * Most icons are re-exported from lucide-react under their historical
 * antd names; a few frequent actions use ReUI Motion Icons
 * (`src/reui/icons/*`) for hover animations. Components migrate by
 * swapping the import path only.
 */
import CrossIcon from './reui/icons/animated/outline/cross';
import PencilIcon from './reui/icons/animated/outline/pencil';
import PlayCircleIcon from './reui/icons/animated/outline/play-circle';
import RefreshArrowClockwiseIcon from './reui/icons/animated/outline/refresh-arrow-clockwise';
import TrashSquareIcon from './reui/icons/animated/outline/trash-square';

export {
  Network as ApartmentOutlined,
  Plug as ApiOutlined,
  ArrowDown as ArrowDownOutlined,
  ArrowRight as ArrowRightOutlined,
  ArrowUp as ArrowUpOutlined,
  BookOpen as BookOutlined,
  CircleCheckBig as CheckCircleTwoTone,
  Eraser as ClearOutlined,
  CircleX as CloseCircleTwoTone,
  CloudDownload as CloudDownloadOutlined,
  CloudUpload as CloudUploadOutlined,
  Minimize2 as CompressOutlined,
  GitFork as DeploymentUnitOutlined,
  ChevronDown as DownOutlined,
  Move as DragOutlined,
  Upload as ExportOutlined,
  Paintbrush as FormatPainterOutlined,
  GripVertical as HolderOutlined,
  Download as ImportOutlined,
  Info as InfoCircleOutlined,
  ChevronLeft as LeftOutlined,
  SquareMinus as MinusSquareOutlined,
  Ellipsis as MoreOutlined,
  CirclePlus as PlusCircleOutlined,
  Plus as PlusOutlined,
  SquarePlus as PlusSquareOutlined,
  ChevronRight as RightOutlined,
  Search as SearchOutlined,
  ArrowLeftRight as SwapOutlined,

  List as UnorderedListOutlined,
  TriangleAlert as WarningFilled,
  TriangleAlert as WarningOutlined,
} from 'lucide-react';

export {
  CrossIcon as CloseOutlined,
  TrashSquareIcon as DeleteOutlined,
  PencilIcon as EditOutlined,
  PlayCircleIcon as PlayCircleOutlined,
  RefreshArrowClockwiseIcon as SyncOutlined,
};
