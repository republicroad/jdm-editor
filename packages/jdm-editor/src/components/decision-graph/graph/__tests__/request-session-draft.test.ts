import { describe, expect, test } from 'vitest';

import { type RequestSessionDraft, applyRequestSessionDraft, buildRequestSessionDraft } from '../request-session-draft';

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

  test('build 全字段齐带（五个会话维度一个不落）', () => {
    const draft = buildRequestSessionDraft({
      activeTab: 'examples',
      schemaDraft: 'S',
      activeSourceIndex: 2,
      activeExampleJsonDraft: '{"a":1}',
      activeDescriptionDraft: 'note',
    });
    expect(draft).toEqual({
      activeTab: 'examples',
      schemaDraft: 'S',
      activeSourceIndex: 2,
      activeExampleJsonDraft: '{"a":1}',
      activeDescriptionDraft: 'note',
    });
  });

  test('apply：applier 缺省时对应字段静默跳过（宿主未接全 setter 不崩）', () => {
    const calls: string[] = [];
    applyRequestSessionDraft(
      buildRequestSessionDraft({
        activeTab: 'schema',
        schemaDraft: 'S',
        activeSourceIndex: 1,
        activeExampleJsonDraft: 'E',
        activeDescriptionDraft: 'D',
      }),
      {
        setActiveTab: (tab) => calls.push(`tab:${tab}`),
        // setSchemaDraft / setActiveSourceIndex 未提供
        setActiveDescriptionDraft: (v) => calls.push(`desc:${v}`),
      },
    );
    expect(calls).toEqual(['tab:schema', 'desc:D']);
  });

  test('apply：全字段按 tab → schema → sourceIndex → example → description 顺序回填', () => {
    const calls: string[] = [];
    applyRequestSessionDraft(
      buildRequestSessionDraft({
        activeTab: 'examples',
        schemaDraft: 'S',
        activeSourceIndex: 3,
        activeExampleJsonDraft: 'E',
        activeDescriptionDraft: 'D',
      }),
      {
        setActiveTab: (t) => calls.push(`tab:${t}`),
        setSchemaDraft: (v) => calls.push(`schema:${v}`),
        setActiveSourceIndex: (i) => calls.push(`src:${i}`),
        setActiveExampleJsonDraft: (v) => calls.push(`example:${v}`),
        setActiveDescriptionDraft: (v) => calls.push(`desc:${v}`),
      },
    );
    expect(calls).toEqual(['tab:examples', 'schema:S', 'src:3', 'example:E', 'desc:D']);
  });

  test('JSON 往返：快照可安全序列化，undefined 字段不复活、不覆盖宿主态', () => {
    const snapshot = JSON.parse(
      JSON.stringify(buildRequestSessionDraft({ activeTab: 'schema', activeSourceIndex: 0 })),
    ) as RequestSessionDraft;

    expect(Object.keys(snapshot).sort()).toEqual(['activeSourceIndex', 'activeTab']);

    const calls: string[] = [];
    applyRequestSessionDraft(snapshot, {
      setActiveTab: (t) => calls.push(`tab:${t}`),
      setSchemaDraft: (v) => calls.push(`schema:${v}`),
      setActiveSourceIndex: (i) => calls.push(`src:${i}`),
      setActiveExampleJsonDraft: (v) => calls.push(`example:${v}`),
      setActiveDescriptionDraft: (v) => calls.push(`desc:${v}`),
    });
    expect(calls).toEqual(['tab:schema', 'src:0']);
  });
});
