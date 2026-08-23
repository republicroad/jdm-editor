/**
 * Internal icon layer.
 *
 * Every icon previously imported from @ant-design/icons is re-exported
 * here under its historical name, backed by lucide-react. Components
 * migrate by swapping the import path only:
 *
 *   - import { CloseOutlined } from '@/icons';
 *   + import { CloseOutlined } from '@/icons';
 *
 * Keep this file in sync while any @ant-design/icons usage remains; it is
 * deleted once Stage D removes the dependency entirely.
 */
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
  X as CloseOutlined,
  CloudDownload as CloudDownloadOutlined,
  CloudUpload as CloudUploadOutlined,
  Minimize2 as CompressOutlined,
  Trash2 as DeleteOutlined,
  GitFork as DeploymentUnitOutlined,
  ChevronDown as DownOutlined,
  Move as DragOutlined,
  Pencil as EditOutlined,
  Upload as ExportOutlined,
  Paintbrush as FormatPainterOutlined,
  GripVertical as HolderOutlined,
  Download as ImportOutlined,
  Info as InfoCircleOutlined,
  ChevronLeft as LeftOutlined,
  SquareMinus as MinusSquareOutlined,
  Ellipsis as MoreOutlined,
  CirclePlay as PlayCircleOutlined,
  CirclePlus as PlusCircleOutlined,
  Plus as PlusOutlined,
  SquarePlus as PlusSquareOutlined,
  ChevronRight as RightOutlined,
  Search as SearchOutlined,
  ArrowLeftRight as SwapOutlined,
  RefreshCw as SyncOutlined,
  List as UnorderedListOutlined,
  TriangleAlert as WarningFilled,
  TriangleAlert as WarningOutlined,
} from 'lucide-react';
