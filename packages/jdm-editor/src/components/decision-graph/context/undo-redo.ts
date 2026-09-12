/**
 * Undo/redo stack for decision graph editing (S009-A).
 *
 * Snapshot approach: each `push` captures the pre-mutation graph; `undo` and
 * `redo` move the pointer between past and future. Text-edit debouncing is
 * handled by the caller (merge rapid updates into one push).
 */
export function createUndoRedoStack<T>(maxSize = 100) {
  let past: T[] = [];
  let future: T[] = [];

  return {
    /** Push a pre-mutation snapshot; clears the redo stack */
    push(state: T): void {
      past.push(state);
      if (past.length > maxSize) past.shift();
      future = [];
    },
    undo(current: T): T | null {
      const prev = past.pop();
      if (prev === undefined) return null;
      future.push(current);
      return prev;
    },
    redo(current: T): T | null {
      const next = future.pop();
      if (next === undefined) return null;
      past.push(current);
      return next;
    },
    get canUndo(): boolean {
      return past.length > 0;
    },
    get canRedo(): boolean {
      return future.length > 0;
    },
    clear(): void {
      past = [];
      future = [];
    },
  };
}
