import { useEffect } from 'react';
import type { EditorView } from '@codemirror/view';

export interface UseFieldDropOptions {
  onFieldDrop?: (fieldPath: string) => void;
}

export function useFieldDrop(
  editor: EditorView | null,
  options: UseFieldDropOptions = {}
) {
  useEffect(() => {
    if (!editor) return;

    const domNode = editor.dom;
    if (!domNode) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const data = e.dataTransfer?.getData('application/json');
        if (!data) return;

        const fieldInfo = JSON.parse(data);
        const fieldPath = fieldInfo.path || '';

        // 获取鼠标位置对应的编辑器位置
        const pos = editor.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos === null) return;

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
        options.onFieldDrop?.(fieldPath);
      } catch (error) {
        console.error('Failed to handle field drop:', error);
      }
    };

    domNode.addEventListener('dragover', handleDragOver);
    domNode.addEventListener('drop', handleDrop);

    return () => {
      domNode.removeEventListener('dragover', handleDragOver);
      domNode.removeEventListener('drop', handleDrop);
    };
  }, [editor, options.onFieldDrop]);
}
