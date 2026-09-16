/**
 * React Flow 以自有 --xy-* 变量绘制画布部件（controls/minimap/连线/选区/归因等）；
 * 将变量映射到设计 token（--border/--primary/--card/…，见 styles/tokens.css）后，
 * 画布外观随主题与暗色模式联动，而非停留在 xyflow 出厂默认。
 * 移植自 ReUI flow-1 块（flow-canvas.tsx 的 FLOW_THEME）。与 .grl-dg .react-flow__*
 * 元素级覆盖正交：变量层给默认色，元素层仍可覆盖具体部件。
 */
export const XYFLOW_THEME = [
  '[--xy-background-color:transparent]',
  '[--xy-background-pattern-color:var(--border)]',
  '[--xy-edge-stroke:color-mix(in_oklab,var(--muted-foreground)_45%,transparent)]',
  '[--xy-edge-stroke-selected:var(--primary)]',
  '[--xy-edge-stroke-width:1]',
  '[--xy-edge-label-background-color:var(--card)]',
  '[--xy-edge-label-color:var(--muted-foreground)]',
  '[--xy-connectionline-stroke:var(--primary)]',
  '[--xy-connectionline-stroke-width:1]',
  '[--xy-handle-background-color:var(--primary)]',
  '[--xy-handle-border-color:var(--card)]',
  '[--xy-controls-button-background-color:var(--card)]',
  '[--xy-controls-button-background-color-hover:var(--muted)]',
  '[--xy-controls-button-border-color:var(--border)]',
  '[--xy-controls-button-color:var(--foreground)]',
  '[--xy-controls-button-color-hover:var(--foreground)]',
  '[--xy-controls-box-shadow:none]',
  '[--xy-minimap-background-color:var(--card)]',
  '[--xy-minimap-mask-background-color:color-mix(in_oklab,var(--muted)_70%,transparent)]',
  '[--xy-minimap-node-background-color:color-mix(in_oklab,var(--muted-foreground)_35%,transparent)]',
  '[--xy-selection-background-color:color-mix(in_oklab,var(--primary)_8%,transparent)]',
  '[--xy-selection-border:1px_dashed_var(--primary)]',
  '[--xy-attribution-background-color:transparent]',
].join(' ');
