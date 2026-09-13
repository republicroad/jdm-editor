import { getExecContext } from '../exec-context.ts';
import { defineContrib } from '../register.ts';
import { queryRoster } from '../roster.ts';

export default defineContrib(import.meta.url, {
  tools: [
    {
      name: 'roster',
      description: '查询名单：在服务端指定名单中查询某个值是否存在，返回命中结果.',
      parametersSchema: {
        properties: {
          roster: {
            type: 'string',
            title: '名单',
            description: '服务端名单名称(从名单下拉中动态选择)',
          },
          value: {
            type: 'string',
            title: '查询值',
            description: '待查询的值',
          },
        },
        required: ['roster', 'value'],
        title: 'roster',
        type: 'object',
      },
      returnsSchema: { type: 'object', title: 'roster 函数返回', properties: {} },
      fn: function queryListUdf(kwargs: Record<string, unknown>) {
        const ctx = getExecContext();
        if (!ctx?.tenantId) return { hit: false, roster: String(kwargs?.roster ?? ''), value: kwargs?.value ?? null };
        return queryRoster(String(kwargs?.roster ?? ''), kwargs?.value ?? null, {
          tenantId: ctx.tenantId,
          actor: ctx.userId,
        });
      },
    },
  ],
});
