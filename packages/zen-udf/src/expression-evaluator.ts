import { evaluateExpressionSync } from '@gorules/zen-engine';

import type { ExpressionEvaluator } from './fixtures.ts';

/** Node 世界便利工厂：zen-expression 对结果求值（根绑定 result，ADR-014 OQ3）。
 * 独立模块——fixtures.ts（runner 子路径 @republicroad/zen-udf/runner）保持零引擎
 * 依赖，表达式求值器只在根包面提供（ADR-014 包面注记）。 */
export const createZenExpressionEvaluator = (): ExpressionEvaluator => (source, data) =>
  evaluateExpressionSync(source, { result: data }) !== false;
