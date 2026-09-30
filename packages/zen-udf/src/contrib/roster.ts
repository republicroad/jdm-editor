import { Type } from '@sinclair/typebox';

import { getExecContext } from '../exec-context.ts';
import { globalUdfRegistry } from '../register.ts';
import { queryRoster } from '../roster.ts';
import { pack, tool } from '../tool.ts';

export const rosterTool = tool({
  namespace: 'roster',
  name: 'roster',
  title: 'roster',
  description: '查询名单：在服务端指定名单中查询某个值是否存在，返回命中结果.',
  semantics: 'query',
  input: Type.Object({
    roster: Type.String({ title: '名单', description: '服务端名单名称(从名单下拉中动态选择)' }),
    value: Type.String({ title: '查询值', description: '待查询的值' }),
  }),
  output: Type.Object({}, { title: 'roster 函数返回' }),
  run: (input) => {
    const ctx = getExecContext();
    if (!ctx?.tenantId) return { hit: false, roster: input.roster, value: input.value ?? null };
    return queryRoster(input.roster, input.value ?? null, {
      tenantId: ctx.tenantId,
      actor: ctx.userId,
    });
  },
});

export default pack({ id: 'roster', tools: [rosterTool] });

// 全局注册（import 副作用，接替 defineContrib 的模块级注册）
globalUdfRegistry.register(pack({ id: 'roster', tools: [rosterTool] }));
