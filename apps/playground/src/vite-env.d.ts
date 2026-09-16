/// <reference types="vite/client" />

// 内核以源码直通方式消费，其依赖中的无类型包在此补声明
// （@gorules/lezer-* 仅在 CodeMirror 表达式高亮中使用，运行时无类型契约）
declare module '@gorules/lezer-zen';
declare module '@gorules/lezer-zen-template';
