/**
 * 字段树视图组件
 * 用于显示解析后的字段结构，支持展开/收起、拖拽和点击操作
 */

import {
  CaretDownOutlined,
  CaretRightOutlined,
  CheckSquareOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  NumberOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Empty } from 'antd';
import React, { useState } from 'react';

import type { FieldInfo } from '../../../helpers/field-parser';

import './field-tree-view.scss';

/**
 * 字段树项组件属性
 */
export interface FieldTreeItemProps {
  field: FieldInfo;
  depth: number;
  onFieldClick?: (field: FieldInfo) => void;
  onFieldDragStart?: (field: FieldInfo, e: React.DragEvent) => void;
}

/**
 * 字段树视图组件属性
 */
export interface FieldTreeViewProps {
  fields: FieldInfo[];
  onFieldClick?: (field: FieldInfo) => void;
  onFieldDragStart?: (field: FieldInfo, e: React.DragEvent) => void;
  emptyText?: string;
}

/**
 * 获取字段类型对应的图标
 */
const getTypeIcon = (type: FieldInfo['type']) => {
  switch (type) {
    case 'string':
      return <FontSizeOutlined />;
    case 'number':
      return <NumberOutlined />;
    case 'boolean':
      return <CheckSquareOutlined />;
    case 'array':
      return <UnorderedListOutlined />;
    case 'object':
      return <DatabaseOutlined />;
    default:
      return <FileTextOutlined />;
  }
};

/**
 * 格式化字段值用于预览
 */
const formatValue = (value: unknown, type: FieldInfo['type']): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (type) {
    case 'string':
      return `"${String(value).substring(0, 50)}"`;
    case 'number':
    case 'boolean':
      return String(value);
    case 'array':
      return Array.isArray(value) ? `[${value.length}]` : '[]';
    case 'object':
      return '{...}';
    default:
      return String(value).substring(0, 50);
  }
};

/**
 * 字段树项组件
 */
const FieldTreeItem: React.FC<FieldTreeItemProps> = ({
  field,
  depth,
  onFieldClick,
  onFieldDragStart,
}) => {
  // 判断是否可展开（object 或 array 类型且有子字段）
  const isExpandable = (field.type === 'object' || field.type === 'array') &&
                       field.children &&
                       field.children.length > 0;

  // 默认展开前2层
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  // 处理点击事件
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isExpandable) {
      // 容器节点：切换展开状态
      setIsExpanded(!isExpanded);
    } else {
      // 叶子节点：触发点击回调
      onFieldClick?.(field);
    }
  };

  // 处理拖拽开始事件
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    onFieldDragStart?.(field, e);
  };

  // 计算缩进
  const indent = depth * 16;

  return (
    <div className="field-tree-item">
      <div
        className={`field-tree-item__content ${!isExpandable ? 'field-tree-item__content--leaf' : ''}`}
        style={{ paddingLeft: `${indent}px` }}
        onClick={handleClick}
        draggable={!isExpandable}
        onDragStart={handleDragStart}
      >
        {/* 展开/收起图标 */}
        <span className="field-tree-item__expand-icon">
          {isExpandable ? (
            isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />
          ) : (
            <span className="field-tree-item__expand-icon--placeholder" />
          )}
        </span>

        {/* 类型图标 */}
        <span className="field-tree-item__type-icon">
          {getTypeIcon(field.type)}
        </span>

        {/* 字段名 */}
        <span className="field-tree-item__name">{field.name}</span>

        {/* 类型标签 */}
        <span className="field-tree-item__type">{field.type}</span>

        {/* 数组类型提示 */}
        {field.type === 'array' && field.arrayItemType && (
          <span className="field-tree-item__array-type">
            {field.arrayItemType}[]
          </span>
        )}

        {/* 值预览 */}
        {field.value !== undefined && !isExpandable && (
          <span className="field-tree-item__value">
            {formatValue(field.value, field.type)}
          </span>
        )}
      </div>

      {/* 递归渲染子字段 */}
      {isExpandable && isExpanded && field.children && (
        <div className="field-tree-item__children">
          {field.children.map((child, index) => (
            <FieldTreeItem
              key={`${child.path}-${index}`}
              field={child}
              depth={depth + 1}
              onFieldClick={onFieldClick}
              onFieldDragStart={onFieldDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 字段树视图容器组件
 */
export const FieldTreeView: React.FC<FieldTreeViewProps> = ({
  fields,
  onFieldClick,
  onFieldDragStart,
  emptyText = '暂无字段数据',
}) => {
  // 空状态
  if (!fields || fields.length === 0) {
    return (
      <div className="field-tree-view field-tree-view--empty">
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div className="field-tree-view">
      {fields.map((field, index) => (
        <FieldTreeItem
          key={`${field.path}-${index}`}
          field={field}
          depth={0}
          onFieldClick={onFieldClick}
          onFieldDragStart={onFieldDragStart}
        />
      ))}
    </div>
  );
};
