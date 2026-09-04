import { describe, expect, test } from 'vitest';

import {
  applyRequestSessionDraft,
  buildRequestSessionDraft,
  type RequestSessionDraft,
} from '../request-session-draft';

const committed = { activeTab: 'definitions', schemaDraft: undefined };

describe('request-session-draft', () => {
  test('build 只携带已定义字段（undefined 字段不进快照）', () => {
    const draft = buildRequestSessionDraft({
      activeTab: 'schema',
      schemaDraft: '{"type":"object"}',
      activeSourceIndex: 1,
    });
    expect(draft).toEqual({ activeTab: 'schema', schemaDraft: '{"type":"object"}', activeSourceIndex: 1 });
    expect('activeExampleJsonDraft' in draft).toBe(false);
  });

  test('apply 空草稿为 no-op，含字段时逐项回填', () => {
    const calls: string[] = [];
    applyRequestSessionDraft(undefined, {
      setActiveTab: () => calls.push('tab'),
      setSchemaDraft: () => calls.push('schema'),
    });
    expect(calls).toEqual([]);

    applyRequestSessionDraft({ activeTab: 'schema', schemaDraft: 'D' } as RequestSessionDraft, {
      setActiveTab: (tab) => calls.push(`tab:${tab}`),
      setSchemaDraft: (v) => calls.push(`schema:${v}`),
    });
    expect(calls).toEqual(['tab:schema', 'schema:D']);
  });

  test('restore 回填在途草稿（模拟 700ms 防抖窗口内保存→重开）', () => {
    // 保存时快照捕获了未落 content 的在途草稿
    const draft = buildRequestSessionDraft({
      activeTab: 'schema',
      schemaDraft: '{"type":"object","properties":{"a":{"type":"string"}}}',
    });
    // 重开时编辑器初始为已提交态（空 schema），restore 回填草稿
    const applied: { schemaDraft?: string; activeTab?: string } = {};
    applyRequestSessionDraft(draft, {
      setActiveTab: (tab) => (applied.activeTab = tab),
      setSchemaDraft: (v) => (applied.schemaDraft = v),
    });
    expect(applied.schemaDraft).toBe('{"type":"object","properties":{"a":{"type":"string"}}}');
    expect(applied.activeTab).toBe('schema');
  });
});
