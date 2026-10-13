import { ChevronDownIcon } from 'lucide-react';

import {
  Cascader,
  CascaderContent,
  CascaderEmpty,
  CascaderList,
  CascaderPanel,
  CascaderStatus,
  CascaderTrigger,
} from './cascader';
import { CascaderItems } from './cascader-item';
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from './cascader-nav';
import type { CascaderNode } from './cascader-types';

export type FieldPickerPopupProps = {
  nodes: CascaderNode[];
  /** 受控触发态由外壳持有；这里只负责选中后回传整条路径 */
  onPick: (path: string) => void;
  /** 弹层关闭（item-press / 外点）→ 外壳卸载，下次点击重挂新生 */
  onClose: () => void;
  disabled?: boolean;
  triggerClassName: string;
  triggerLabel: string;
  placeholder: string;
};

/**
 * TypedInput 字段选择弹层（c-cascader-21 形态）：tree 模式整棵展开 +
 * 全树搜索（searchScope=global，命中带路径轨迹），分支/叶子均可选中
 * （selectable="any"——`customer` 本身即合法 reference）。
 * 懒加载模块：Base UI 组合件走宿主 external，本 chunk 仅在首开弹层时下载。
 * 挂载即开（defaultOpen）——外壳点击的意图就是打开。
 */
export default function FieldPickerPopup({
  nodes,
  onPick,
  onClose,
  disabled,
  triggerClassName,
  triggerLabel,
  placeholder,
}: FieldPickerPopupProps) {
  return (
    <Cascader
      items={nodes}
      mode='tree'
      searchScope='global'
      selectable='any'
      defaultOpen
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      onValueChange={(value) => {
        if (value != null) {
          onPick(String(value));
        }
      }}
    >
      <CascaderTrigger
        render={
          <button type='button' className={triggerClassName} disabled={disabled}>
            <span className='min-w-0 flex-1 truncate text-left'>{triggerLabel}</span>
            <ChevronDownIcon className='size-3.5 shrink-0 opacity-60' />
          </button>
        }
      >
        <CascaderValue placeholder={placeholder} />
      </CascaderTrigger>
      <CascaderContent className='w-72'>
        <CascaderPanel>
          <CascaderNav>
            <CascaderInput placeholder={placeholder} />
          </CascaderNav>
          <CascaderBreadcrumb />
          <CascaderEmpty />
          <CascaderList>
            <CascaderItems />
          </CascaderList>
          <CascaderStatus />
        </CascaderPanel>
      </CascaderContent>
    </Cascader>
  );
}
