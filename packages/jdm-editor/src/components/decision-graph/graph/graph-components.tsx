import type { XYPosition } from '@xyflow/react';
import clsx from 'clsx';
import React, { useCallback, useMemo, useState } from 'react';
import { match } from 'ts-pattern';

import { Input } from '../../primitives';
import { useDecisionGraphState } from '../context/dg-store.context';
import { DecisionNode } from '../nodes/decision-node';
import { NodeKind, type NodeSpecification } from '../nodes/specifications/specification-types';
import { nodeSpecification } from '../nodes/specifications/specifications';
import { matchComponent } from './component-search';

export type GraphComponentsProps = {
  inputDisabled?: boolean;
  components?: React.ReactNode[];
  disabled?: boolean;
  collapsed?: boolean;
  /** ADR-009：租户级目录过滤挂点——治理线实现过滤逻辑，未传 = 不过滤（本层不做租户语义） */
  tenantFilter?: (specification: NodeSpecification) => boolean;
};

export { matchComponent } from './component-search';

export const GraphComponents: React.FC<GraphComponentsProps> = React.memo(
  ({ inputDisabled, disabled, collapsed, tenantFilter }) => {
    const customComponents = useDecisionGraphState((store) => store.components || []);
    const customNodes = useDecisionGraphState((store) => store.customNodes || []);

    const [search, setSearch] = useState('');

    const onDragStart = useCallback((event: React.DragEvent, nodeType: string, component?: string) => {
      const target = event.target as HTMLDivElement;
      if (!target) {
        return;
      }

      const { offsetX, offsetY } = event.nativeEvent;
      const { height, width } = target.getBoundingClientRect();

      const positionData: XYPosition = {
        x: offsetX / width,
        y: offsetY / height,
      };

      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('nodeType', nodeType);
      event.dataTransfer.setData('relativePosition', JSON.stringify(positionData));
      if (component) {
        event.dataTransfer.setData('customNodeComponent', component);
      }
    }, []);

    const innerGroups = useMemo<Record<string, NodeSpecification[]>>(() => {
      const initialGroups: Record<string, NodeSpecification[]> = {
        core: Object.values(nodeSpecification),
      };
      if (customComponents?.length > 0) {
        initialGroups.extended = customComponents;
      }

      (customNodes || []).forEach((node) => {
        const group = node.group?.trim?.() || '';
        if (group.length > 0) {
          if (initialGroups?.[group]) {
            initialGroups[group].push({ ...node, type: 'customNode' });
          } else {
            initialGroups[group] = [{ ...node, type: 'customNode' }];
          }
        }
      });

      (customNodes || []).forEach((node) => {
        if (!node?.group) {
          if (initialGroups?.['custom']) {
            initialGroups['custom'].push({ ...node, type: 'customNode' });
          } else {
            initialGroups['custom'] = [{ ...node, type: 'customNode' }];
          }
        }
      });

      return initialGroups;
    }, [customComponents, customNodes]);

    const groups = useMemo<Record<string, NodeSpecification[]>>(() => {
      return Object.keys(innerGroups).reduce((acc, key) => {
        return {
          ...acc,
          [key]: (innerGroups[key] || []).filter(
            (el) =>
              (!tenantFilter || tenantFilter(el)) &&
              (!(search?.trim?.().length > 0) || matchComponent(el, search) !== null),
          ),
        };
      }, {});
    }, [innerGroups, search, tenantFilter]);

    const customCount = customComponents.length + customNodes.length;

    return (
      <div>
        {customCount > 5 && (
          <Input
            placeholder={'Search components...'}
            value={search}
            onChange={(e) => setSearch(e.target.value || '')}
            allowClear
            className={'sticky top-0 z-[1] h-auto rounded-none border-0 shadow-none text-[13px]'}
          />
        )}
        <div className={'flex grow flex-col'}>
          {Object.keys(groups).map((group) => {
            return match(group)
              .with(
                'core',
                () =>
                  groups['core']?.length > 0 && (
                    <React.Fragment key={group}>
                      {(groups['core'] || []).map((node) => {
                        const matched = search?.trim?.() ? matchComponent(node, search) : null;
                        return (
                          <React.Fragment key={'kind' in node ? (node.kind as string) : node.type}>
                            <DragDecisionNode
                              collapsed={collapsed}
                              disabled={match(node.type)
                                .with(NodeKind.Input, () => disabled || inputDisabled)
                                .otherwise(() => disabled)}
                              specification={node}
                              matchedKeywords={matched && matched.length > 0 ? matched : undefined}
                              onDragStart={(event) =>
                                nodeSpecification[node.type as NodeKind] !== undefined
                                  ? onDragStart(event, node.type)
                                  : onDragStart(event, 'customNode', 'kind' in node ? (node.kind as string) : '')
                              }
                            />
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ),
              )
              .otherwise(
                (group) =>
                  groups[group]?.length > 0 && (
                    <React.Fragment key={group}>
                      {(groups?.[group] || []).map((customNode) => {
                        const matched = search?.trim?.() ? matchComponent(customNode, search) : null;
                        return (
                          <DragDecisionNode
                            collapsed={collapsed}
                            key={'kind' in customNode ? (customNode.kind as string) : customNode.type}
                            disabled={disabled}
                            specification={customNode}
                            matchedKeywords={matched && matched.length > 0 ? matched : undefined}
                            onDragStart={(event) =>
                              group === 'extended'
                                ? onDragStart(event, customNode.type)
                                : onDragStart(
                                    event,
                                    'customNode',
                                    'kind' in customNode ? (customNode.kind as string) : '',
                                  )
                            }
                          />
                        );
                      })}
                    </React.Fragment>
                  ),
              );
          })}
        </div>
      </div>
    );
  },
);

/** ADR-009：目录 origin 徽标——pack 元数据的可视化（数据经 schema 端点/文件协议透传） */
const ORIGIN_BADGE: Record<string, { label: string; title: string }> = {
  reference: { label: 'REF', title: 'Reference domain — ships with zen-udf' },
  extension: { label: 'EXT', title: 'Extension pack' },
  industry: { label: 'IND', title: 'Industry pack (proprietary)' },
};

const DragDecisionNode: React.FC<
  {
    specification: Pick<
      NodeSpecification,
      'color' | 'icon' | 'displayName' | 'shortDescription' | 'searchKeywords' | 'meta'
    >;
    /** L6：经 searchKeywords（内部工具名等）命中时的高亮词条——替换 shortDescription 徽标展示 */
    matchedKeywords?: string[];
    disabled?: boolean;
    collapsed?: boolean;
  } & React.HTMLAttributes<HTMLDivElement>
> = ({ specification, matchedKeywords, disabled = false, collapsed, ...props }) => {
  const originBadge = specification.meta ? ORIGIN_BADGE[specification.meta.origin] : undefined;
  return (
    <div
      className={clsx('draggable-component relative cursor-grab [transform:translate(0)]')}
      draggable={!disabled}
      {...props}
    >
      {originBadge && (
        <span
          title={originBadge.title}
          className='text-muted-foreground bg-background absolute end-1.5 top-1.5 z-[1] rounded border border-[var(--border)] px-1 text-[10px] leading-4'
        >
          {originBadge.label}
        </span>
      )}
      <div style={{ pointerEvents: 'none' }}>
        <DecisionNode
          listMode
          compactMode
          color={specification.color}
          icon={specification.icon}
          name={collapsed ? undefined : (specification.displayName as string)}
          type={
            collapsed
              ? undefined
              : matchedKeywords && matchedKeywords.length > 0
                ? matchedKeywords.slice(0, 3).join(' · ')
                : specification.shortDescription
          }
        />
      </div>
    </div>
  );
};
