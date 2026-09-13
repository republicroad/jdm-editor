import { getExecContext } from '../exec-context.ts';
import { defineContrib } from '../register.ts';
import { queryRoster } from '../roster.ts';

/**
 * 旧平台函数域重建（第六十九批 D2，docs/13 §8.3）：名单查询复用 roster 存储的
 * queryRoster。调用形态对齐撞库攻击防御.json：`custom_list_query;;"名单名";;值`。
 * 返回图内 returnSchema 声明的 {result}（actor 隔离与 roster UDF 一致）。
 */
export default defineContrib(import.meta.url, {
  tools: [
    {
      name: 'custom_list_query',
      description: '旧域重建·名单查询：在服务端指定名单中查询某个值是否存在，返回 {result}。',
      parametersSchema: {
        properties: {
          list_name: {
            type: 'string',
            title: '名单名称',
            description: '服务端名单名称',
          },
          value: {
            type: 'string',
            title: '查询值',
            description: '待查询的值',
          },
        },
        required: ['list_name', 'value'],
        title: 'custom_list_query',
        type: 'object',
      },
      returnsSchema: {
        type: 'object',
        title: 'custom_list_query_result',
        properties: {
          result: { type: 'boolean', title: 'Result' },
        },
        required: ['result'],
      },
      fn: function customListQueryUdf(kwargs: Record<string, unknown>) {
        const { hit } = queryRoster(String(kwargs?.list_name ?? ''), kwargs?.value ?? null, getExecContext()?.userId);
        return { result: hit };
      },
    },
  ],
});
