import type { Node, NodeList } from "tool-json";
import {
  isArray,
  getChild,
  getChildren,
  getDescendants,
  equal,
  compare,
} from "tool-json";
import type { Query } from "./query.ts";
import type { Segment, ChildSegment, DescendantSegment } from "./segment.ts";
import { SegmentKind } from "./segment.ts";
import type {
  Selector,
  NameSelector,
  WildcardSelector,
  IndexSelector,
  SliceSelector,
  FilterSelector,
} from "./selector.ts";
import { SelectorKind } from "./selector.ts";
import type {
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
import { ExpressionKind, ComparisonOperator } from "./expression.ts";
import { DeclaredType } from "./expression.ts";
import { singularValue } from "./function.ts";
import type { QueryContext, QueryContextOptions } from "./context.ts";
import { coerceQueryContext } from "./context.ts";
import { parseQuery } from "./parse.ts";

/**
 * Evaluates a JSONPath query expression with the given root node
 * as the query argument.
 *
 * @throws QueryError if the query string is malformed.
 * @category Evaluate
 */
export function evaluateQuery(
  query: Query | string,
  root: Node,
  options?: QueryContextOptions,
): NodeList {
  const context = coerceQueryContext(options);

  if (typeof query === "string") {
    query = parseQuery(query, context);
  }

  let nodes = [root];

  const queryArgument = context.queryArgument;
  try {
    context.queryArgument = root;
    for (const segment of query.segments) {
      nodes = evaluateSegment(segment, nodes, context);
    }
  } finally {
    context.queryArgument = queryArgument;
  }

  return nodes;
}

/**
 * Evaluates a segment against the given node list.
 *
 * @category Evaluate
 */
export function evaluateSegment(
  segment: Segment,
  nodes: Readonly<NodeList>,
  context: QueryContext,
): NodeList {
  const kind = segment.kind;
  switch (kind) {
    case SegmentKind.Child:
      return evaluateChildSegment(segment, nodes, context);
    case SegmentKind.Descendant:
      return evaluateDescendantSegment(segment, nodes, context);
    default:
      throw new TypeError("Invalid SegmentKind: " + kind);
  }
}

/**
 * Evaluates a child segment against the given node list.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateChildSegment(
  segment: ChildSegment,
  nodes: Readonly<NodeList>,
  context: QueryContext,
): NodeList {
  const output: NodeList = [];
  for (const selector of segment.selectors) {
    for (const node of nodes) {
      output.push(...evaluateSelector(selector, node, context));
    }
  }
  return output;
}

/**
 * Evaluates a descendant segment against the given node list.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateDescendantSegment(
  segment: DescendantSegment,
  nodes: Readonly<NodeList>,
  context: QueryContext,
): NodeList {
  const output: NodeList = [];
  if (segment.selectors.length !== 0) {
    for (const node of nodes) {
      for (const selector of segment.selectors) {
        output.push(...evaluateSelector(selector, node, context));
      }
      for (const descendant of getDescendants(node)) {
        for (const selector of segment.selectors) {
          output.push(...evaluateSelector(selector, descendant, context));
        }
      }
    }
  }
  return output;
}

/**
 * Evaluates a selector against the given node.
 *
 * @category Evaluate
 */
export function evaluateSelector(
  selector: Selector,
  node: Node,
  context: QueryContext,
): NodeList {
  const kind = selector.kind;
  switch (kind) {
    case SelectorKind.Name:
      return evaluateNameSelector(selector, node);
    case SelectorKind.Wildcard:
      return evaluateWildcardSelector(selector, node);
    case SelectorKind.Index:
      return evaluateIndexSelector(selector, node);
    case SelectorKind.Slice:
      return evaluateSliceSelector(selector, node);
    case SelectorKind.Filter:
      return evaluateFilterSelector(selector, node, context);
    default:
      throw new TypeError("Invalid SelectorKind: " + kind);
  }
}

/**
 * Evaluates a name selector against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateNameSelector(
  selector: NameSelector,
  node: Node,
): NodeList {
  const output: NodeList = [];
  const child = getChild(node, selector.name);
  if (child !== undefined) {
    output.push(child);
  }
  return output;
}

/**
 * Evaluates a wildcard selector against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateWildcardSelector(
  selector: WildcardSelector,
  node: Node,
): NodeList {
  return getChildren(node);
}

/**
 * Evaluates an index selector against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateIndexSelector(
  selector: IndexSelector,
  node: Node,
): NodeList {
  let index = selector.index;
  if (index < 0 && isArray(node)) {
    index += node.length;
  }

  const output: NodeList = [];
  const child = isArray(node) ? node[index] : undefined;
  if (child !== undefined) {
    output.push(child);
  }
  return output;
}

/**
 * Evaluates a slice selector against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateSliceSelector(
  selector: SliceSelector,
  node: Node,
): NodeList {
  const output: NodeList = [];
  const len = isArray(node) ? node.length : 0;
  const step = len !== 0 ? (selector.step ?? 1) : 0;

  if (step > 0) {
    let start = selector.start ?? 0;
    let end = selector.end ?? len;

    start = start >= 0 ? start : len + start;
    end = end >= 0 ? end : len + end;

    const lower = Math.min(Math.max(start, 0), len);
    const upper = Math.min(Math.max(end, 0), len);
    for (let i = lower; i < upper; i += step) {
      output.push((node as NodeList)[i]);
    }
  } else if (step < 0) {
    let start = selector.start ?? len - 1;
    let end = selector.end ?? -len - 1;

    start = start >= 0 ? start : len + start;
    end = end >= 0 ? end : len + end;

    const upper = Math.min(Math.max(start, -1), len - 1);
    const lower = Math.min(Math.max(end, -1), len - 1);
    for (let i = upper; i > lower; i += step) {
      output.push((node as NodeList)[i]);
    }
  }

  return output;
}

/**
 * Evaluates a filter selector against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateFilterSelector(
  selector: FilterSelector,
  node: Node,
  context: QueryContext,
): NodeList {
  const output: NodeList = [];
  for (const child of getChildren(node)) {
    if (evaluateExpression(selector.expression, child, context)) {
      output.push(child);
    }
  }
  return output;
}

/**
 * Evaluates an expression against the given node.
 *
 * @category Evaluate
 */
export function evaluateExpression(
  expression: Expression,
  node: Node,
  context: QueryContext,
): boolean {
  const kind = expression.kind;
  switch (kind) {
    case ExpressionKind.Or:
      return evaluateOrExpression(expression, node, context);
    case ExpressionKind.And:
      return evaluateAndExpression(expression, node, context);
    case ExpressionKind.Comparison:
      return evaluateComparisonExpression(expression, node, context);
    case ExpressionKind.Not:
      return evaluateNotExpression(expression, node, context);
    case ExpressionKind.Query:
      return evaluateQueryTestExpression(expression, node, context);
    case ExpressionKind.Literal:
      throw new TypeError("Invalid literal expression");
    case ExpressionKind.Function:
      return evaluateFunctionTestExpression(expression, node, context);
    default:
      throw new TypeError("Invalid ExpressionKind: " + kind);
  }
}

/**
 * Evaluates an OR expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateOrExpression(
  expression: OrExpression,
  node: Node,
  context: QueryContext,
): boolean {
  for (const operand of expression.operands) {
    if (evaluateExpression(operand, node, context)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluates an AND expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateAndExpression(
  expression: AndExpression,
  node: Node,
  context: QueryContext,
): boolean {
  for (const operand of expression.operands) {
    if (!evaluateExpression(operand, node, context)) {
      return false;
    }
  }
  return true;
}

/**
 * Evaluates a comparison expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateComparisonExpression(
  expression: ComparisonExpression,
  node: Node,
  context: QueryContext,
): boolean {
  const lhs = evaluateComparableExpression(expression.lhs, node, context);
  const rhs = evaluateComparableExpression(expression.rhs, node, context);
  if (lhs.length === 0 || rhs.length === 0) {
    const operator = expression.operator;
    switch (operator) {
      case ComparisonOperator.Equal:
      case ComparisonOperator.LessThanOrEqual:
      case ComparisonOperator.GreaterThanOrEqual:
        return lhs.length === rhs.length;
      case ComparisonOperator.NotEqual:
        return lhs.length !== rhs.length;
      case ComparisonOperator.LessThan:
      case ComparisonOperator.GreaterThan:
        return false;
      default:
        throw new TypeError("Invalid ComparisonOperator: " + operator);
    }
  } else if (lhs.length !== 1 || rhs.length !== 1) {
    return false;
  }

  const operator = expression.operator;
  switch (operator) {
    case ComparisonOperator.Equal:
      return equal(lhs[0], rhs[0]);
    case ComparisonOperator.NotEqual:
      return !equal(lhs[0], rhs[0]);
    case ComparisonOperator.LessThan:
      return (compare(lhs[0], rhs[0]) ?? 1) < 0;
    case ComparisonOperator.LessThanOrEqual:
      return (compare(lhs[0], rhs[0]) ?? 1) <= 0;
    case ComparisonOperator.GreaterThan:
      return (compare(lhs[0], rhs[0]) ?? -1) > 0;
    case ComparisonOperator.GreaterThanOrEqual:
      return (compare(lhs[0], rhs[0]) ?? -1) >= 0;
    default:
      throw new TypeError("Invalid ComparisonOperator: " + operator);
  }
}

/**
 * Evaluates a NOT expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateNotExpression(
  expression: NotExpression,
  node: Node,
  context: QueryContext,
): boolean {
  return !evaluateExpression(expression.operand, node, context);
}

/**
 * Evaluates a query test expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateQueryTestExpression(
  expression: QueryExpression,
  node: Node,
  context: QueryContext,
): boolean {
  return existenceTest(evaluateQueryExpression(expression, node, context));
}

/**
 * Evaluates a function test expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateFunctionTestExpression(
  expression: FunctionExpression,
  node: Node,
  context: QueryContext,
): boolean {
  const args = evaluateFunctionArguments(expression, node, context);

  const resultType = expression.func.resultType;
  switch (resultType) {
    case DeclaredType.Value:
      throw new TypeError(
        "ValueType function not supported in test expression",
      );
    case DeclaredType.Logical:
      return expression.func.evaluate(args, context);
    case DeclaredType.Nodes:
      return existenceTest(expression.func.evaluate(args, context));
    default:
      throw new TypeError("Invalid DeclaredType: " + resultType);
  }
}

/**
 * Evaluates a comparable expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateComparableExpression(
  expression: ComparableExpression,
  node: Node,
  context: QueryContext,
): NodeList {
  const kind = expression.kind;
  switch (kind) {
    case ExpressionKind.Literal:
      return evaluateLiteralExpression(expression);
    case ExpressionKind.Query:
      return evaluateQueryExpression(expression, node, context);
    case ExpressionKind.Function:
      return evaluateFunctionExpression(expression, node, context);
    default:
      throw new TypeError("Invalid ComparableExpressionKind: " + kind);
  }
}

/**
 * Evaluates a literal expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateLiteralExpression(
  expression: LiteralExpression,
): NodeList {
  return [expression.value];
}

/**
 * Evaluates a query expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateQueryExpression(
  expression: QueryExpression,
  node: Node,
  context: QueryContext,
): NodeList {
  let root: Node;
  if (expression.identifier === "@") {
    root = node;
  } else if (expression.identifier === "$") {
    root = context.queryArgument;
  } else {
    throw new TypeError(
      "Unsupported node identifier: " + expression.identifier,
    );
  }

  let nodes = [root];

  const queryArgument = context.queryArgument;
  try {
    context.queryArgument = root;
    for (const segment of expression.segments) {
      nodes = evaluateSegment(segment, nodes, context);
    }
  } finally {
    context.queryArgument = queryArgument;
  }

  return nodes;
}

/**
 * Evaluates a function expression against the given node.
 *
 * @category Evaluate
 * @internal
 */
export function evaluateFunctionExpression(
  expression: FunctionExpression,
  node: Node,
  context: QueryContext,
): NodeList {
  const args = evaluateFunctionArguments(expression, node, context);

  const resultType = expression.func.resultType;
  switch (resultType) {
    case DeclaredType.Value:
      return valueTypeList(expression.func.evaluate(args, context));
    case DeclaredType.Logical:
      throw new TypeError(
        "LogicalType function not supported in comparison expression",
      );
    case DeclaredType.Nodes:
      throw new TypeError(
        "NodesType function not supported in comparison expression",
      );
    default:
      throw new TypeError("Invalid DeclaredType: " + resultType);
  }
}

/**
 * Evaluates an array of function arguments against the given node.
 *
 * @category Evaluate
 * @internal
 */
function evaluateFunctionArguments(
  expression: FunctionExpression,
  node: Node,
  context: QueryContext,
): ExpressionType[] {
  if (expression.args.length !== expression.func.parameterTypes.length) {
    throw new TypeError(
      "Expected " +
        expression.func.parameterTypes.length +
        " arguments for function " +
        expression.func.name +
        ", but received " +
        expression.args.length +
        " arguments",
    );
  }

  const args: ExpressionType[] = [];
  for (let i = 0; i < expression.func.parameterTypes.length; i += 1) {
    const argType = expression.func.parameterTypes[i]!;
    const arg = expression.args[i]!;
    args.push(evaluateFunctionArgument(argType, arg, node, context));
  }
  return args;
}

/**
 * Evaluates a function argument against the given node.
 *
 * @category Evaluate
 * @internal
 */
function evaluateFunctionArgument(
  parameterType: DeclaredType,
  expression: Expression,
  node: Node,
  context: QueryContext,
): ExpressionType {
  switch (parameterType) {
    case DeclaredType.Value:
      return evaluateValueFunctionArgument(expression, node, context);
    case DeclaredType.Logical:
      return evaluateLogicalFunctionArgument(expression, node, context);
    case DeclaredType.Nodes:
      return evaluateNodesFunctionArgument(expression, node, context);
    default:
      throw new TypeError("Invalid DeclaredType: " + parameterType);
  }
}

/**
 * Evaluates a ValueType function argument against the given node.
 *
 * @category Evaluate
 * @internal
 */
function evaluateValueFunctionArgument(
  expression: Expression,
  node: Node,
  context: QueryContext,
): ValueType {
  if (expression.kind === ExpressionKind.Function) {
    const resultType = expression.func.resultType;
    switch (resultType) {
      case DeclaredType.Value:
        return expression.func.evaluate(
          evaluateFunctionArguments(expression, node, context),
          context,
        );
      case DeclaredType.Logical:
        throw new TypeError(
          "LogicalType function not supported in ValueType argument position",
        );
      case DeclaredType.Nodes:
        throw new TypeError(
          "NodesType function not supported in ValueType argument position",
        );
      default:
        throw new TypeError("Invalid DeclaredType: " + resultType);
    }
  }

  if (expression.kind === ExpressionKind.Literal) {
    return expression.value;
  }

  if (expression.kind === ExpressionKind.Query) {
    return singularValue(evaluateQueryExpression(expression, node, context));
  }

  throw new TypeError(
    "ValueType function argument must be a ValueType function expression, a literal expression, or a singular query expression",
  );
}

/**
 * Evaluates a LogicalType function argument against the given node.
 *
 * @category Evaluate
 * @internal
 */
function evaluateLogicalFunctionArgument(
  expression: Expression,
  node: Node,
  context: QueryContext,
): LogicalType {
  if (expression.kind === ExpressionKind.Function) {
    const resultType = expression.func.resultType;
    switch (resultType) {
      case DeclaredType.Value:
        throw new TypeError(
          "ValueType function not supported in LogicalType argument position",
        );
      case DeclaredType.Logical:
        return expression.func.evaluate(
          evaluateFunctionArguments(expression, node, context),
          context,
        );
      case DeclaredType.Nodes:
        return existenceTest(
          expression.func.evaluate(
            evaluateFunctionArguments(expression, node, context),
            context,
          ),
        );
      default:
        throw new TypeError("Invalid DeclaredType: " + resultType);
    }
  }

  return evaluateExpression(expression, node, context);
}

/**
 * Evaluates a NodesType function argument against the given node.
 *
 * @category Evaluate
 * @internal
 */
function evaluateNodesFunctionArgument(
  expression: Expression,
  node: Node,
  context: QueryContext,
): NodesType {
  if (expression.kind === ExpressionKind.Function) {
    const resultType = expression.func.resultType;
    switch (resultType) {
      case DeclaredType.Value:
        throw new TypeError(
          "ValueType function not supported in NodesType argument position",
        );
      case DeclaredType.Logical:
        throw new TypeError(
          "LogicalType function not supported in NodesType argument position",
        );
      case DeclaredType.Nodes:
        return expression.func.evaluate(
          evaluateFunctionArguments(expression, node, context),
          context,
        );
      default:
        throw new TypeError("Invalid DeclaredType: " + resultType);
    }
  }

  if (expression.kind === ExpressionKind.Query) {
    return evaluateQueryExpression(expression, node, context);
  }

  throw new TypeError(
    "NodesType function argument must be a NodesType function expression or a query expression",
  );
}

/**
 * Returns `true` if the given node list is not empty.
 *
 * @category Evaluate
 * @internal
 */
function existenceTest(nodes: Readonly<NodeList>): boolean {
  return nodes.length !== 0;
}

/**
 * Converts a ValueType to a nodelist.
 *
 * @category Evaluate
 * @internal
 */
function valueTypeList(value: ValueType): NodeList {
  const output: NodeList = [];
  if (value !== undefined) {
    output.push(value);
  }
  return output;
}
