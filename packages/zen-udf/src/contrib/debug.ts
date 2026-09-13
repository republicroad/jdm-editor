import { defineContrib, defineTool } from '../register.ts';

// ext 约定：缺省 namespace 取文件名(debug)，集合容器档(多函数多行调用)
export default defineContrib(import.meta.url, {
  tools: [
    defineTool({
      name: 'inout',
      description: 'Docstring for inout\n自定义函数测试, 返回值返回入参, 用于调试.',
      parametersSchema: {
        properties: {
          b: { description: '参数 b', title: 'B', type: 'integer' },
          a: {
            anyOf: [{ type: 'string' }, { type: 'integer' }],
            description: '参数 a',
            title: 'A',
          },
          c: { description: '参数 c', title: 'C', type: 'null' },
        },
        required: ['b', 'a', 'c'],
        title: 'inout',
        type: 'object',
      },
      returnsSchema: { type: 'string', title: 'inout 函数返回', properties: {} },
      fn: function (kwargs: Record<string, unknown>) {
        return kwargs?.['_node_input_'] ?? {};
      },
    }),
    defineTool({
      name: 'func_without_args',
      description: 'Docstring for func_without_args\n无参数函数, 用于自定义函数测试',
      parametersSchema: {
        properties: {},
        title: 'func_without_args',
        type: 'object',
      },
      returnsSchema: { type: 'string', title: 'func_without_args 函数返回', properties: {} },
      fn: function (kwargs: Record<string, unknown>) {
        return kwargs?.['_node_input_'] ?? {};
      },
    }),
  ],
});
