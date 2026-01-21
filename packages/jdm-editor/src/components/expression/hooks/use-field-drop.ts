import { useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';

export interface UseFieldDropOptions {
  onFieldDrop?: (fieldPath: string) => void;
}

export function useFieldDrop(
  editor: EditorView | null,
  options: UseFieldDropOptions = {}
) {
  // 使用 ref 存储回调，避免依赖变化导致重新绑定事件
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!editor) {
      console.log('[useFieldDrop] Editor is null, skipping setup');
      return;
    }

    const domNode = editor.dom;
    if (!domNode) {
      console.log('[useFieldDrop] DOM node is null, skipping setup');
      return;
    }

    console.log('[useFieldDrop] Setting up drag-drop listeners on editor');

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      console.log('[useFieldDrop] Drop event received');

      try {
        const data = e.dataTransfer?.getData('application/json');
        if (!data) {
          console.log('[useFieldDrop] No JSON data in drop event');
          return;
        }

        const fieldInfo = JSON.parse(data);
        const fieldPath = fieldInfo.path || '';

        console.log('[useFieldDrop] Dropping field:', fieldPath);

        // 获取鼠标位置对应的编辑器位置
        const pos = editor.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos === null) {
          console.log('[useFieldDrop] Could not get position at coords');
          return;
        }

        console.log('[useFieldDrop] Inserting at position:', pos);

        // 在目标位置插入字段路径
        editor.dispatch({
          changes: {
            from: pos,
            to: pos,
            insert: fieldPath
          },
          selection: { anchor: pos + fieldPath.length }
        });

        // 聚焦编辑器
        editor.focus();

        console.log('[useFieldDrop] Field inserted successfully');
        optionsRef.current.onFieldDrop?.(fieldPath);
      } catch (error) {
        console.error('[useFieldDrop] Failed to handle field drop:', error);
      }
    };

    domNode.addEventListener('dragover', handleDragOver);
    domNode.addEventListener('drop', handleDrop);

    console.log('[useFieldDrop] Listeners attached');

    return () => {
      domNode.removeEventListener('dragover', handleDragOver);
      domNode.removeEventListener('drop', handleDrop);
      console.log('[useFieldDrop] Listeners removed');
    };
  }, [editor]); // 只依赖 editor
}
