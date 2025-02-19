import type { Node, NodeList } from "tool-json";
import type { Segment } from "./segment.ts";
import type { FunctionExtension } from "./function.ts";

/**
 * The declared result type of an expression.
 *
 * @category Expression
 */
export type DeclaredType = (typeof DeclaredType)[keyof typeof DeclaredType];

export const DeclaredType = {
  /**
   * The expression returns JSON values or Nothing.
   */
  Value: 0,

  /**
   * The expression returns LogicalTrue or LogicalFalse.
   */
  Logical: 1,

  /**
   * The expression returns nodelists.
   */
  Nodes: 2,
} as const;

/**
 * The result type of an expression that returns JSON values or Nothing.
 * The special result Nothing represents the absence of a JSON value and is
 * distinct from any JSON value, including null.
 *
 * @category Expression
 */
export type ValueType = Node | undefined;

/**
 * The result type of an expression that returns LogicalTrue or LogicalFalse,
 * distinct from the JSON values expressed by the literals true and false.
 *
 * @category Expression
 */
export type LogicalType = boolean;

/**
 * The result type of an expression that returns a nodelist.
 *
 * @category Expression
 */
export type NodesType = NodeList;

/**
 * The evaluated type of an expression.
 *
 * @category Expression
 */
export type ExpressionType = ValueType | LogicalType | NodesType;

/**
 * The syntax kind of an expression.
 *
 * @category Expression
 */
export type ExpressionKind =
  (typeof ExpressionKind)[keyof typeof ExpressionKind];

export const ExpressionKind = {
  Or: 8,
  And: 9,
  Comparison: 10,
  Not: 11,
  Query: 12,
  Literal: 13,
  Function: 14,
} as const;

/**
 * An expression that evaluates to a boolean value.
 *
 * @category Expression
 */
export type Expression =
  | OrExpression
  | AndExpression
  | ComparisonExpression
  | NotExpression
  | QueryExpression
  | LiteralExpression
  | FunctionExpression;

/**
 * Gets the precedence of an expression.
 *
 * @category Expression
 */
export function getExpressionPrecedence(expression: Expression): number {
  switch (expression.kind) {
    case ExpressionKind.Or:
      return 1;
    case ExpressionKind.And:
      return 2;
    case ExpressionKind.Comparison:
      return 3;
    case ExpressionKind.Not:
      return 4;
    case ExpressionKind.Query:
    case ExpressionKind.Literal:
    case ExpressionKind.Function:
    default:
      return 5;
  }
}

/**
 * A logical OR expression.
 *
 * @category Expression
 */
export interface OrExpression {
  readonly kind: typeof ExpressionKind.Or;

  readonly operands: readonly Expression[];
}

/**
 * Creates a logical OR expression.
 *
 * @category Expression
 */
export function createOrExpression(
  operands: readonly Expression[],
): OrExpression {
  return { kind: ExpressionKind.Or, operands };
}

/**
 * A logical AND expression.
 *
 * @category Expression
 */
export interface AndExpression {
  readonly kind: typeof ExpressionKind.And;

  readonly operands: readonly Expression[];
}

/**
 * Creates a logical AND expression.
 *
 * @category Expression
 */
export function createAndExpression(
  operands: readonly Expression[],
): AndExpression {
  return { kind: ExpressionKind.And, operands };
}

/**
 * An expression that can be compared to another expression.
 *
 * @category Expression
 */
export type ComparableExpression =
  | LiteralExpression
  | QueryExpression
  | FunctionExpression;

/**
 * A comparison operator.
 *
 * @category Expression
 */
export type ComparisonOperator =
  (typeof ComparisonOperator)[keyof typeof ComparisonOperator];

export const ComparisonOperator = {
  Equal: 0,
  NotEqual: 1,
  LessThan: 2,
  LessThanOrEqual: 3,
  GreaterThan: 4,
  GreaterThanOrEqual: 5,
} as const;

/**
 * A comparison expression.
 *
 * @category Expression
 */
export interface ComparisonExpression {
  readonly kind: typeof ExpressionKind.Comparison;

  readonly lhs: ComparableExpression;

  readonly operator: ComparisonOperator;

  readonly rhs: ComparableExpression;
}

/**
 * Creates a comparison expression.
 *
 * @category Expression
 */
export function createComparisonExpression(
  lhs: ComparableExpression,
  operator: ComparisonOperator,
  rhs: ComparableExpression,
): ComparisonExpression {
  return { kind: ExpressionKind.Comparison, lhs, operator, rhs };
}

/**
 * A logical NOT expression.
 *
 * @category Expression
 */
export interface NotExpression {
  readonly kind: typeof ExpressionKind.Not;

  readonly operand: Expression;
}

/**
 * Creates a logical NOT expression.
 *
 * @category Expression
 */
export function createNotExpression(operand: Expression): NotExpression {
  return { kind: ExpressionKind.Not, operand };
}

/**
 * A query test expression.
 *
 * @category Expression
 */
export interface QueryExpression {
  readonly kind: typeof ExpressionKind.Query;

  readonly identifier: "$" | "@";

  readonly segments: readonly Segment[];
}

/**
 * Creates a query expression.
 *
 * @category Expression
 */
export function createQueryExpression(
  identifier: "$" | "@",
  segments: readonly Segment[],
): QueryExpression {
  return { kind: ExpressionKind.Query, identifier, segments };
}

/**
 * A literal expression operand.
 *
 * @category Expression
 */
export interface LiteralExpression {
  readonly kind: typeof ExpressionKind.Literal;

  readonly value: unknown;
}

/**
 * Creates a literal expression.
 *
 * @category Expression
 */
export function createLiteralExpression(value: unknown): LiteralExpression {
  return { kind: ExpressionKind.Literal, value };
}

/**
 * A function call expression.
 *
 * @category Expression
 */
export interface FunctionExpression {
  readonly kind: typeof ExpressionKind.Function;

  readonly func: FunctionExtension;

  readonly args: readonly Expression[];
}

/**
 * Creates a function call expression.
 *
 * @category Expression
 */
export function createFunctionExpression(
  func: FunctionExtension,
  args: readonly Expression[],
): FunctionExpression {
  return { kind: ExpressionKind.Function, func, args };
}
