import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { StateEffect, StateField } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import type { FieldInfo } from '../../../helpers/field-parser';
import { flattenFields, parseFields } from '../../../helpers/field-parser';

// 定义更新输入数据的 Effect
export const updateInputDataEffect = StateEffect.define<unknown>();

// 创建 StateField 来存储输入数据
export const inputDataField = StateField.define<unknown>({
  create: () => null,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(updateInputDataEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

// 获取字段类型的图标
const getFieldIcon = (type: string): string => {
  switch (type) {
    case 'string':
      return '📝';
    case 'number':
      return '🔢';
    case 'boolean':
      return '✓';
    case 'array':
      return '📋';
    case 'object':
      return '📦';
    case 'null':
      return '∅';
    default:
      return '•';
  }
};

// 格式化字段值用于预览
const formatValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return 'Object';
  return String(value);
};

// 字段自动补全函数
export const fieldCompletion = (context: CompletionContext): CompletionResult | null => {
  // 获取当前输入数据
  const inputData = context.state.field(inputDataField, false);
  if (!inputData) {
    return null;
  }

  // 解析字段
  const fields = parseFields(inputData, { maxDepth: 10, includeValues: true });
  const flatFields = flattenFields(fields);

  // 获取当前光标位置的单词
  const word = context.matchBefore(/[\w.$]*/);
  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  // 过滤和排序字段
  const searchText = word.text.toLowerCase();
  const options = flatFields
    .filter((field) => {
      // 如果没有输入，显示所有字段
      if (!searchText) return true;

      // 模糊匹配：字段路径包含搜索文本
      return field.path.toLowerCase().includes(searchText) ||
             field.name.toLowerCase().includes(searchText);
    })
    .map((field) => ({
      label: field.path,
      type: 'variable',
      detail: `${getFieldIcon(field.type)} ${field.type}`,
      info: field.value !== undefined ? formatValue(field.value) : undefined,
      boost: field.path.toLowerCase().startsWith(searchText) ? 1 : 0, // 前缀匹配优先
    }));

  return {
    from: word.from,
    options,
    validFor: /^[\w.$]*$/,
  };
};

// 导出更新输入数据的辅助函数
export const updateInputData = (inputData: unknown) => {
  return updateInputDataEffect.of(inputData);
};

/**
 * 字段拖拽扩展
 * 处理从字段树拖拽字段到编辑器的功能
 *
 * 注意：这个扩展需要与 react-dnd 共存
 * 通过捕获阶段监听事件来确保在 react-dnd 之前处理
 */
export const fieldDragDropExtension = () => {
  return EditorView.domEventHandlers({
    drop(event, view) {
      console.log('[fieldDragDropExtension] Drop event triggered');

      try {
        // 获取拖拽数据
        const data = event.dataTransfer?.getData('application/json');
        console.log('[fieldDragDropExtension] Raw drag data:', data);

        if (!data) {
          console.log('[fieldDragDropExtension] No drag data found');
          return false;
        }

        const dragData = JSON.parse(data);
        console.log('[fieldDragDropExtension] Parsed drag data:', dragData);

        // 检查是否是字段拖拽（通过检查是否有 path 或 nodePath 字段）
        const fieldPath = dragData.path || dragData.nodePath;
        if (!fieldPath) {
          console.log('[fieldDragDropExtension] No field path in drag data, not a field drag');
          return false;
        }

        // 这是字段拖拽，阻止默认行为和冒泡
        event.preventDefault();
        event.stopPropagation();

        console.log('[fieldDragDropExtension] Inserting field path:', fieldPath);

        // 获取光标位置
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) {
          console.log('[fieldDragDropExtension] Could not determine cursor position');
          return false;
        }

        console.log('[fieldDragDropExtension] Insert position:', pos);

        // 插入字段路径
        view.dispatch({
          changes: { from: pos, insert: fieldPath },
          selection: { anchor: pos + fieldPath.length },
        });

        console.log('[fieldDragDropExtension] Field inserted successfully');
        return true;
      } catch (error) {
        console.error('[fieldDragDropExtension] Error handling drop:', error);
        return false;
      }
    },

    dragover(event) {
      console.log('[fieldDragDropExtension] Dragover event');

      // 检查是否是字段拖拽
      try {
        const types = event.dataTransfer?.types || [];
        console.log('[fieldDragDropExtension] Drag types:', types);

        if (types.includes('application/json')) {
          // 允许拖放
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer!.dropEffect = 'copy';
          return true;
        }
      } catch (error) {
        console.error('[fieldDragDropExtension] Error in dragover:', error);
      }

      return false;
    },

    dragenter(event) {
      console.log('[fieldDragDropExtension] Dragenter event');

      // 检查是否是字段拖拽
      try {
        const types = event.dataTransfer?.types || [];
        if (types.includes('application/json')) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      } catch (error) {
        console.error('[fieldDragDropExtension] Error in dragenter:', error);
      }

      return false;
    },
  });
};
