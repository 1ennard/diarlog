import {
  mdiArrowDown,
  mdiArrowUp,
  mdiBackupRestore,
  mdiCalendarBlank,
  mdiCalendarBlankOutline,
  mdiCalendarRange,
  mdiChartBar,
  mdiChartLineVariant,
  mdiCheck,
  mdiCheckboxBlankOutline,
  mdiCheckboxMarked,
  mdiCheckCircleOutline,
  mdiChevronLeft,
  mdiChevronRight,
  mdiClose,
  mdiContentCopy,
  mdiDelete,
  mdiDotsVertical,
  mdiDownload,
  mdiEraser,
  mdiFileDelimited,
  mdiFormatListBulleted,
  mdiImage,
  mdiMagnify,
  mdiMinus,
  mdiPencil,
  mdiPercentOutline,
  mdiPlus,
  mdiPound,
  mdiReorderHorizontal,
  mdiSubdirectoryArrowLeft,
  mdiTable,
  mdiText,
  mdiThemeLightDark,
  mdiUndoVariant,
  mdiUpload,
  mdiDeleteSweep,
  mdiFlask,
  mdiDragVertical,
} from '@mdi/js';
import type { LogType } from '../lib/model';

const ICONS = {
  add: mdiPlus,
  remove: mdiMinus,
  edit: mdiPencil,
  check: mdiCheck,
  today: mdiCheckCircleOutline,
  history: mdiCalendarBlankOutline,
  historyFilled: mdiCalendarBlank,
  trend: mdiChartLineVariant,
  back: mdiChevronLeft,
  forward: mdiChevronRight,
  close: mdiClose,
  delete: mdiDelete,
  copy: mdiContentCopy,
  reorder: mdiReorderHorizontal,
  undo: mdiUndoVariant,
  checkbox: mdiCheckboxMarked,
  checkboxOff: mdiCheckboxBlankOutline,
  text: mdiText,
  choice: mdiFormatListBulleted,
  image: mdiImage,
  number: mdiPound,
  percent: mdiPercentOutline,
  more: mdiDotsVertical,
  search: mdiMagnify,
  prefilled: mdiSubdirectoryArrowLeft,
  calendarRange: mdiCalendarRange,
  bar: mdiChartBar,
  table: mdiTable,
  up: mdiArrowUp,
  down: mdiArrowDown,
  download: mdiDownload,
  upload: mdiUpload,
  theme: mdiThemeLightDark,
  restore: mdiBackupRestore,
  eraser: mdiEraser,
  csv: mdiFileDelimited,
  deleteAll: mdiDeleteSweep,
  demo: mdiFlask,
  drag: mdiDragVertical,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : 'icon'} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} fill="currentColor" />
    </svg>
  );
}

export function typeIcon(t: LogType): IconName {
  return t === 'checkbox' ? 'checkbox' : t === 'number' ? 'number' : t === 'percent' ? 'percent' : t === 'text' ? 'text' : 'choice';
}
