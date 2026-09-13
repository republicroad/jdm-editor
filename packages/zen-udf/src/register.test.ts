import { describe, expect, test } from 'vitest';

import { UDFManager } from './register.ts';

const captureWarns = (run: (manager: UDFManager) => void): string[] => {
  const warns: string[] = [];
  const original = console.warn;
  console.warn = (message: unknown) => {
    warns.push(String(message));
  };
  try {
    run(new UDFManager());
  } finally {
    console.warn = original;
  }
  return warns;
};

describe('UDFManager namespace collision warnings', () => {
  test('函数名与自身 namespace 同名时警告', () => {
    const warns = captureWarns((manager) => manager.registerFunction(() => null, 'roster', undefined, 'roster'));
    expect(warns.some((warn) => warn.includes("'roster'"))).toBe(true);
  });

  test('函数名与现有 namespace 同名时警告', () => {
    const warns = captureWarns((manager) => {
      manager.registerFunction(() => null, 'counter', undefined, 'rate_1h');
      manager.registerFunction(() => null, 'debug', undefined, 'counter');
    });
    expect(warns.some((warn) => warn.includes("'counter'"))).toBe(true);
  });

  test('namespace 与现有函数同名时警告', () => {
    const warns = captureWarns((manager) => {
      manager.registerFunction(() => null, 'debug', undefined, 'roster');
      manager.registerFunction(() => null, 'roster', undefined, 'query_list');
    });
    expect(warns.some((warn) => warn.includes("namespace 'roster'"))).toBe(true);
  });

  test('无碰撞时不警告', () => {
    const warns = captureWarns((manager) => manager.registerFunction(() => null, 'debug', undefined, 'inout'));
    expect(warns).toHaveLength(0);
  });
});
