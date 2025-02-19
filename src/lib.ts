export type { QueryErrorOptions } from "./error.ts";
export { QueryError } from "./error.ts";

export type { Query } from "./query.ts";
export { createQuery, isSingularQuery } from "./query.ts";

export type { Segment, ChildSegment, DescendantSegment } from "./segment.ts";
export {
  SegmentKind,
  isSingularSegment,
  createChildSegment,
  createDescendantSegment,
} from "./segment.ts";

export type {
  Selector,
  NameSelector,
  WildcardSelector,
  ArraySelector,
  IndexSelector,
  SliceSelector,
  FilterSelector,
} from "./selector.ts";
export {
  SelectorKind,
  isSingularSelector,
  createNameSelector,
  createWildcardSelector,
  createIndexSelector,
  createSliceSelector,
  createFilterSelector,
} from "./selector.ts";

export type {
  ValueType,
  LogicalType,
  NodesType,
  ExpressionType,
  Expression,
  OrExpression,
  AndExpression,
  ComparableExpression,
  ComparisonExpression,
  NotExpression,
  QueryExpression,
  LiteralExpression,
  FunctionExpression,
} from "./expression.ts";
export {
  DeclaredType,
  ExpressionKind,
  getExpressionPrecedence,
  createOrExpression,
  createAndExpression,
  ComparisonOperator,
  createComparisonExpression,
  createNotExpression,
  createQueryExpression,
  createLiteralExpression,
  createFunctionExpression,
} from "./expression.ts";

export type {
  FunctionExtension,
  ValueFunctionExtension,
  LogicalFunctionExtension,
  NodesFunctionExtension,
} from "./function.ts";
export {
  lengthFunction,
  countFunction,
  matchFunction,
  searchFunction,
  valueFunction,
  intrinsicFunctions,
} from "./function.ts";

export type { QueryContext, QueryContextOptions } from "./context.ts";
export {
  QueryScope,
  initQueryContext,
  createQueryContext,
  coerceQueryContext,
} from "./context.ts";

export {
  parseQuery,
  tryParseQuery,
  parseImplicitQuery,
  tryParseImplicitQuery,
  parseSegment,
  tryParseSegment,
  parseSelector,
  tryParseSelector,
  parseExpression,
  tryParseExpression,
  parseShorthandName,
  parseBlankSpace,
  isSpaceChar,
} from "./parse.ts";

export {
  formatQuery,
  formatSegment,
  formatChildSegment,
  formatDescendantSegment,
  formatSelector,
  formatNameSelector,
  formatWildcardSelector,
  formatIndexSelector,
  formatSliceSelector,
  formatFilterSelector,
  formatExpression,
  formatOrExpression,
  formatAndExpression,
  formatComparisonExpression,
  formatNotExpression,
  formatQueryExpression,
  formatLiteralExpression,
  formatFunctionExpression,
} from "./format.ts";

export {
  evaluateQuery,
  evaluateSegment,
  evaluateChildSegment,
  evaluateDescendantSegment,
  evaluateSelector,
  evaluateNameSelector,
  evaluateWildcardSelector,
  evaluateIndexSelector,
  evaluateSliceSelector,
  evaluateFilterSelector,
  evaluateExpression,
  evaluateOrExpression,
  evaluateAndExpression,
  evaluateComparisonExpression,
  evaluateNotExpression,
  evaluateQueryTestExpression,
  evaluateFunctionTestExpression,
  evaluateComparableExpression,
  evaluateLiteralExpression,
  evaluateQueryExpression,
  evaluateFunctionExpression,
} from "./evaluate.ts";
