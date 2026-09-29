import { describe, expect, test } from 'vitest';

import type { NodeSpecification } from '../nodes/specifications/specification-types';
import { matchComponent } from './component-search';

const spec = (overrides: Partial<NodeSpecification> = {}): NodeSpecification =>
  ({
    type: 'customNode',
    displayName: 'validate-cn 函数集合',
    shortDescription: '函数集合(4)',
    group: '自定义函数',
    generateNode: () => ({ name: 'n' }),
    renderNode: () => null,
    ...overrides,
  }) as NodeSpecification;

describe('matchComponent (L6 面板搜索索引)', () => {
  test('empty or blank query -> null (no filtering semantics here, just no match data)', () => {
    expect(matchComponent(spec(), '')).toBeNull();
    expect(matchComponent(spec(), '   ')).toBeNull();
  });

  test('own fields still match: type / displayName / shortDescription / group -> [] (no highlight)', () => {
    expect(matchComponent(spec(), 'customnode')).toEqual([]);
    expect(matchComponent(spec(), '函数集合')).toEqual([]);
    expect(matchComponent(spec(), '自定义')).toEqual([]);
  });

  test('internal tool name hits via searchKeywords -> matched keyword terms', () => {
    const el = spec({ searchKeywords: ['id_card', '身份证实名认证', 'id_card_validity'] });
    expect(matchComponent(el, 'id_card')).toEqual(['id_card', 'id_card_validity']);
  });

  test('tool title matches case-insensitively', () => {
    const el = spec({ searchKeywords: ['BankCard Verify'] });
    expect(matchComponent(el, 'bankcard')).toEqual(['BankCard Verify']);
  });

  test('no hit anywhere -> null', () => {
    const el = spec({ searchKeywords: ['id_card'] });
    expect(matchComponent(el, 'phone')).toBeNull();
  });

  test('own-field match takes precedence (returns [] even when keywords also hit)', () => {
    const el = spec({ displayName: 'crypto 函数集合', searchKeywords: ['crypto_hash'] });
    expect(matchComponent(el, 'crypto')).toEqual([]);
  });
});
