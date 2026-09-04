import LockIcon from '../../reui/icons/animated/duotone/lock';

/** 画布节点角标：config.locked === true 时显示，标记此节点有专属页面设计 */
export function LockedCornerBadge() {
  return (
    <span className="pointer-events-none absolute right-2 top-2 z-10 inline-flex" title="专属 UI 节点">
      <LockIcon className="size-4 opacity-80" />
    </span>
  );
}
