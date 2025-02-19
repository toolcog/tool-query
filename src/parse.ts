import { QueryError } from "./error.ts";
import type { Query } from "./query.ts";
import { createQuery, isSingularQuery } from "./query.ts";
import type { Segment } from "./segment.ts";
import { createChildSegment, createDescendantSegment } from "./segment.ts";
import type {
  Selector,
  NameSelector,
  WildcardSelector,
  ArraySelector,
  FilterSelector,
} from "./selector.ts";
import {
  createWildcardSelector,
  createNameSelector,
  createIndexSelector,
  createSliceSelector,
  createFilterSelector,
} from "./selector.ts";
import type {
  Expression,
  ComparableExpression,
  FunctionExpression,
} from "./expression.ts";
import {
  DeclaredType,
  ExpressionKind,
  createOrExpression,
  createAndExpression,
  ComparisonOperator,
  createComparisonExpression,
  createNotExpression,
  createQueryExpression,
  createLiteralExpression,
  createFunctionExpression,
} from "./expression.ts";
import type { FunctionExtension } from "./function.ts";
import type { QueryContext, QueryContextOptions } from "./context.ts";
import { QueryScope, coerceQueryContext } from "./context.ts";

/** @internal */
interface InputBuffer {
  readonly input: string;
  offset: number;
  limit: number;
}

/**
 * Parses an RFC 9535 JSONPath query expression.
 *
 * @throws QueryError if the input is malformed.
 * @category Parse
 */
export function parseQuery(input: string, options?: QueryContextOptions): Query;

/** @internal */
export function parseQuery(
  input: string | InputBuffer,
  context: QueryContextOptions | QueryContext,
): Query;

export function parseQuery(
  input: string | InputBuffer,
  options?: QueryContextOptions | QueryContext,
): Query {
  const context = coerceQueryContext(options);

  const buf =
    typeof input === "string" ?
      { input, offset: 0, limit: input.length }
    : input;

  // §2.1.1 ¶1: A JSONPath query consists of a root identifier ($),
  // which stands for a nodelist that contains the root node of the
  // query argument, followed by a possibly empty sequence of segments.

  // jsonpath-query = root-identifier segments

  // root-identifier = "$"
  const c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  if (c !== 0x24 /*"$"*/) {
    throw new QueryError('Expected root identifier ("$")', buf);
  }
  buf.offset += 1; // "$"

  const segments = parseSegments(buf, context);

  if (typeof input === "string" && buf.offset !== input.length) {
    throw new QueryError("Invalid JSONPath query", buf);
  }
  return createQuery(segments);
}

/**
 * Parses an RFC 9535 JSONPath query expression, returning `undefined` if
 * the input is malformed.
 *
 * @category Parse
 */
export function tryParseQuery(
  input: string,
  options?: QueryContextOptions,
): Query | undefined {
  try {
    return parseQuery(input, options);
  } catch {
    return undefined;
  }
}

/**
 * Parses an RFC 9535 JSONPath query with an optional root identifier.
 *
 * @throws QueryError if the input is malformed.
 * @category Parse
 */
export function parseImplicitQuery(
  input: string,
  options?: QueryContextOptions,
): Query;

/** @internal */
export function parseImplicitQuery(
  input: string | InputBuffer,
  context: QueryContextOptions | QueryContext,
): Query;

export function parseImplicitQuery(
  input: string | InputBuffer,
  options?: QueryContextOptions | QueryContext,
): Query {
  const context = coerceQueryContext(options);

  const buf =
    typeof input === "string" ?
      { input, offset: 0, limit: input.length }
    : input;

  // query-expression = jsonpath-query / implicit-query
  //
  // implicit-query = [(implicit-child-segment / segment) *(S segment)]
  //
  // implicit-child-segment = wildcard-selector / member-name-shorthand

  const segments: Segment[] = [];
  const c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  if (c === 0x24 /*"$"*/) {
    buf.offset += 1; // "$"
  } else if (c === 0x2a /*"*"*/) {
    buf.offset += 1; // "*"
    segments.push(createChildSegment([createWildcardSelector()]));
  } else if (isNameFirstChar(c)) {
    const name = parseShorthandName(buf);
    const selector = createNameSelector(name);
    segments.push(createChildSegment([selector]));
  } else if (isSpaceChar(c)) {
    throw new QueryError("Expected JSONPath query", buf);
  }
  parseSegments(buf, context, segments);

  if (typeof input === "string" && buf.offset !== input.length) {
    throw new QueryError("Invalid JSONPath query", buf);
  }
  return createQuery(segments);
}

/**
 * Parses an RFC 9535 JSONPath query with an optional root identifier,
 * returning `undefined` if the input is malformed.
 *
 * @category Parse
 */
export function tryParseImplicitQuery(
  input: string,
  options?: QueryContextOptions,
): Query | undefined {
  try {
    return parseImplicitQuery(input, options);
  } catch {
    return undefined;
  }
}

/** @internal */
function parseSegments(
  buf: InputBuffer,
  context: QueryContext,
  segments: Segment[] = [],
): Segment[] {
  // segments = *(S segment)
  while (true) {
    parseBlankSpace(buf);
    const segment = parseSegment(buf, context);
    if (segment !== undefined) {
      segments.push(segment);
    } else {
      break;
    }
  }
  return segments;
}

/**
 * Parses a JSONPath segment.
 *
 * @throws QueryError if the input is malformed.
 * @category Parse
 */
export function parseSegment(
  input: string,
  options?: QueryContextOptions,
): Segment | undefined;

/** @internal */
export function parseSegment(
  input: string | InputBuffer,
  context: QueryContextOptions | QueryContext,
): Segment | undefined;

export function parseSegment(
  input: string | InputBuffer,
  options?: QueryContextOptions | QueryContext,
): Segment | undefined {
  const context = coerceQueryContext(options);

  const buf =
    typeof input === "string" ?
      { input, offset: 0, limit: input.length }
    : input;

  let segment: Segment | undefined;
  // Loop used for goto only; it never actually repeats.
  while (true) {
    // segment  = child-segment / descendant-segment
    let c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;

    // child-segment = bracketed-selection /
    //                 ("." (wildcard-selector / member-name-shorthand))
    // descendant-segment  = ".." (bracketed-selection /
    //                             wildcard-selector /
    //                             member-name-shorthand)
    let dotCount: 0 | 1 | 2 = 0;
    if (c === 0x2e /*"."*/) {
      buf.offset += 1; // "."
      dotCount = 1;
      c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;

      if (c === 0x2e /*"."*/) {
        buf.offset += 1; // ".."
        dotCount = 2;
        c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
      }

      if (c === 0x2a /*"*"*/) {
        buf.offset += 1; // "*"
        const selector = createWildcardSelector();
        if (dotCount === 1) {
          segment = createChildSegment([selector]);
        } else if (dotCount === 2) {
          segment = createDescendantSegment([selector]);
        }
        break;
      } else if (isNameFirstChar(c)) {
        const name = parseShorthandName(buf);
        const selector = createNameSelector(name);
        if (dotCount === 1) {
          segment = createChildSegment([selector]);
        } else if (dotCount === 2) {
          segment = createDescendantSegment([selector]);
        }
        break;
      }

      if (dotCount === 1) {
        throw new QueryError("Expected dot segment", buf);
      }

      c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
    }

    // bracketed-selection = "[" S selector *(S "," S selector) S "]"
    if (c !== 0x5b /*"["*/) {
      if (dotCount === 0) {
        break;
      }
      throw new QueryError("Expected bracketed selection", buf);
    }
    buf.offset += 1; // "["

    parseBlankSpace(buf);

    const selectors: Selector[] = [];
    let selectorCount = 0;
    while (true) {
      if (
        buf.offset < buf.limit &&
        buf.input.charCodeAt(buf.offset) === 0x5d /*"]"*/
      ) {
        buf.offset += 1; // "]"
        break;
      }

      if (selectorCount !== 0) {
        if (
          buf.offset >= buf.limit ||
          buf.input.charCodeAt(buf.offset) !== 0x2c /*","*/
        ) {
          throw new QueryError("Expected comma", buf);
        }
        buf.offset += 1; // ","
        parseBlankSpace(buf);
      }

      const selector = parseSelector(buf, context);
      selectors.push(selector);
      selectorCount += 1;

      parseBlankSpace(buf);
    }

    if (dotCount !== 2) {
      segment = createChildSegment(selectors);
    } else {
      segment = createDescendantSegment(selectors);
    }
    break;
  }

  if (typeof input === "string" && buf.offset !== input.length) {
    throw new QueryError("Invalid JSONPath segment", buf);
  }
  return segment;
}

/**
 * Parses a JSONPath segment, returning `undefined` if the input
 * is malformed.
 *
 * @category Parse
 */
export function tryParseSegment(
  input: string,
  options?: QueryContextOptions,
): Segment | undefined {
  try {
    return parseSegment(input, options);
  } catch {
    return undefined;
  }
}

/**
 * Parses a JSONPath selector.
 *
 * @throws QueryError if the input is malformed.
 * @category Parse
 */
export function parseSelector(
  input: string,
  options?: QueryContextOptions,
): Selector;

/** @internal */
export function parseSelector(
  input: string | InputBuffer,
  context: QueryContextOptions | QueryContext,
): Selector;

export function parseSelector(
  input: string | InputBuffer,
  options?: QueryContextOptions | QueryContext,
): Selector {
  const context = coerceQueryContext(options);

  const buf =
    typeof input === "string" ?
      { input, offset: 0, limit: input.length }
    : input;

  // selector = name-selector /
  //            wildcard-selector /
  //            slice-selector /
  //            index-selector /
  //            filter-selector
  let selector: Selector;
  const c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  if (c === 0x22 /*"\""*/ || c === 0x27 /*"'"*/) {
    selector = parseNameSelector(buf);
  } else if (c === 0x2a /*"*"*/) {
    selector = parseWildcardSelector(buf);
  } else if (c === 0x2d /*"-"*/ || isDigit(c) || c === 0x3a /*":"*/) {
    selector = parseArraySelector(buf);
  } else if (c === 0x3f /*"?"*/) {
    selector = parseFilterSelector(buf, context);
  } else {
    throw new QueryError("Expected selector", buf);
  }

  if (typeof input === "string" && buf.offset !== input.length) {
    throw new QueryError("Invalid JSONPath selector", buf);
  }
  return selector;
}

/**
 * Parses a JSONPath selector, returning `undefined` if the input
 * is malformed.
 *
 * @category Parse
 */
export function tryParseSelector(
  input: string,
  options?: QueryContextOptions,
): Selector | undefined {
  try {
    return parseSelector(input, options);
  } catch {
    return undefined;
  }
}

/** @internal */
function parseNameSelector(buf: InputBuffer): NameSelector {
  // name-selector = string-literal
  const name = parseStringLiteral(buf);
  return createNameSelector(name);
}

/** @internal */
function parseWildcardSelector(buf: InputBuffer): WildcardSelector {
  // wildcard-selector = "*"
  const c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  if (c !== 0x2a /*"*"*/) {
    throw new QueryError("Expected wildcard selector", buf);
  }
  buf.offset += 1; // "*"
  return createWildcardSelector();
}

/** @internal */
function parseArraySelector(buf: InputBuffer): ArraySelector {
  // index-selector = int ; decimal integer
  // slice-selector = [start S] ":" S [end S] [":" [S step]]
  // start          = int ; included in selection
  // end            = int ; not included in selection
  // step           = int ; default: 1
  let c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;

  let start: number | undefined;
  if (c === 0x2d /*"-"*/ || isDigit(c)) {
    start = parseInt(buf);
    parseBlankSpace(buf);
    c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  }

  if (c !== 0x3a /*":"*/) {
    if (start === undefined) {
      throw new QueryError("Expected index selector", buf);
    }
    return createIndexSelector(start);
  }
  buf.offset += 1; // ":"
  parseBlankSpace(buf);
  c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;

  // [end S]
  let end: number | undefined;
  if (c === 0x2d /*"-"*/ || isDigit(c)) {
    end = parseInt(buf);
    parseBlankSpace(buf);
    c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  }

  // [":" [S step]]
  let step: number | undefined;
  if (c === 0x3a /*":"*/) {
    buf.offset += 1; // ":"
    parseBlankSpace(buf);
    c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
    if (c === 0x2d /*"-"*/ || isDigit(c)) {
      step = parseInt(buf);
    }
  }

  return createSliceSelector(start, end, step);
}

/** @internal */
function parseFilterSelector(
  buf: InputBuffer,
  context: QueryContext,
): FilterSelector {
  // filter-selector = "?" S logical-expr
  if (
    buf.offset >= buf.limit ||
    buf.input.charCodeAt(buf.offset) !== 0x3f /*"?"*/
  ) {
    throw new QueryError("Expected filter selector", buf);
  }
  buf.offset += 1; // "?"
  parseBlankSpace(buf);

  const queryScope = context.queryScope;
  context.queryScope = QueryScope.Expression;
  let expression: Expression;
  try {
    expression = parseExpression(buf, context);
  } finally {
    context.queryScope = queryScope;
  }

  return createFilterSelector(expression);
}

/**
 * Parses a JSONPath expression.
 *
 * @throws QueryError if the input is malformed.
 * @category Parse
 */
export function parseExpression(
  input: string,
  options?: QueryContextOptions,
): Expression;

/** @internal */
export function parseExpression(
  input: string | InputBuffer,
  context: QueryContextOptions | QueryContext,
): Expression;

export function parseExpression(
  input: string | InputBuffer,
  options?: QueryContextOptions | QueryContext,
): Expression {
  const context = coerceQueryContext(options);

  const buf =
    typeof input === "string" ?
      { input, offset: 0, limit: input.length }
    : input;

  // logical-expr = logical-or-expr
  const expression = parseOrExpression(buf, context);

  if (typeof input === "string" && buf.offset !== input.length) {
    throw new QueryError("Invalid JSONPath expression", buf);
  }
  return expression;
}

/**
 * Parses a JSONPath expression, returning `undefined` if the input
 * is malformed.
 *
 * @category Parse
 */
export function tryParseExpression(
  input: string,
  options?: QueryContextOptions,
): Expression | undefined {
  try {
    return parseExpression(input, options);
  } catch {
    return undefined;
  }
}

/** @internal */
function parseOrExpression(
  buf: InputBuffer,
  context: QueryContext,
): Expression {
  // logical-or-expr = logical-and-expr *(S "||" S logical-and-expr)
  let expr: Expression[] | Expression = parseAndExpression(buf, context);

  // *(S "||" S logical-and-expr)
  while (true) {
    parseBlankSpace(buf);

    if (
      buf.offset >= buf.limit ||
      buf.input.charCodeAt(buf.offset) !== 0x7c /*"|"*/
    ) {
      break;
    }
    buf.offset += 1; // "|"

    if (
      buf.offset >= buf.limit ||
      buf.input.charCodeAt(buf.offset) !== 0x7c /*"|"*/
    ) {
      throw new QueryError("Expected || operator", buf);
    }
    buf.offset += 1; // "|"

    parseBlankSpace(buf);

    const operand = parseAndExpression(buf, context);
    if (!Array.isArray(expr)) {
      expr = [expr];
    }
    expr.push(operand);
  }

  if (Array.isArray(expr)) {
    return createOrExpression(expr);
  }

  return expr;
}

/** @internal */
function parseAndExpression(
  buf: InputBuffer,
  context: QueryContext,
): Expression {
  // logical-and-expr = basic-expr *(S "&&" S basic-expr)
  let expr: Expression[] | Expression = parseBasicExpression(buf, context);

  // *(S "&&" S basic-expr)
  while (true) {
    parseBlankSpace(buf);

    if (
      buf.offset >= buf.limit ||
      buf.input.charCodeAt(buf.offset) !== 0x26 /*"&"*/
    ) {
      break;
    }
    buf.offset += 1; // "&"

    if (
      buf.offset >= buf.limit ||
      buf.input.charCodeAt(buf.offset) !== 0x26 /*"&"*/
    ) {
      throw new QueryError("Expected && operator", buf);
    }
    buf.offset += 1; // "&"

    parseBlankSpace(buf);

    const operand = parseBasicExpression(buf, context);
    if (!Array.isArray(expr)) {
      expr = [expr];
    }
    expr.push(operand);
  }

  if (Array.isArray(expr)) {
    return createAndExpression(expr);
  }

  return expr;
}

/** @internal */
function parseBasicExpression(
  buf: InputBuffer,
  context: QueryContext,
): Expression {
  // basic-expr      = paren-expr /
  //                   comparison-expr /
  //                   test-expr
  // paren-expr      = [logical-not-op S] "(" S logical-expr S ")"
  // comparison-expr = comparable S comparison-op S comparable
  // test-expr       = [logical-not-op S] (filter-query / function-expr)

  // [logical-not-op S]
  let unaryOp = -1;
  if (
    buf.offset < buf.limit &&
    buf.input.charCodeAt(buf.offset) === 0x21 /*"!"*/
  ) {
    buf.offset += 1; // "!"
    unaryOp = 0x21 /*"!"*/;
    parseBlankSpace(buf);
  }

  let expr: Expression;
  const c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  if (c === 0x28 /*"("*/) {
    expr = parseParenExpression(buf, context);
  } else {
    // comparison-expr = comparable [S comparison-op S comparable]
    expr = parseComparable(buf, context);
    const exprOffset = buf.offset;

    if (unaryOp === -1) {
      parseBlankSpace(buf);

      const operator = parseComparisonOperator(buf);
      if (operator !== undefined) {
        parseBlankSpace(buf);

        if (expr.kind === ExpressionKind.Query && !isSingularQuery(expr)) {
          throw new QueryError("Only singular queries can be compared", {
            ...buf,
            offset: exprOffset,
          });
        }
        checkComparableType(expr, buf);

        const rhs = parseComparable(buf, context);
        if (rhs.kind === ExpressionKind.Query && !isSingularQuery(rhs)) {
          throw new QueryError("Only singular queries can be compared", buf);
        }
        checkComparableType(rhs, buf);

        expr = createComparisonExpression(expr, operator, rhs);
      } else if (context.queryScope !== QueryScope.Argument) {
        checkLogicalType(expr, buf);
      }
    } else if (context.queryScope !== QueryScope.Argument) {
      checkLogicalType(expr, buf);
    }
  }

  if (unaryOp === 0x21 /*"!"*/) {
    expr = createNotExpression(expr);
  }
  return expr;
}

/** @internal */
function parseParenExpression(
  buf: InputBuffer,
  context: QueryContext,
): Expression {
  if (
    buf.offset >= buf.limit ||
    buf.input.charCodeAt(buf.offset) !== 0x28 /*"("*/
  ) {
    throw new QueryError("Expected open parenthesis", buf);
  }
  buf.offset += 1; // "("

  // S logical-expr S
  parseBlankSpace(buf);
  const expression = parseExpression(buf, context);
  parseBlankSpace(buf);

  if (
    buf.offset >= buf.limit ||
    buf.input.charCodeAt(buf.offset) !== 0x29 /*")"*/
  ) {
    throw new QueryError("Expected close parenthesis", buf);
  }
  buf.offset += 1; // ")"

  return expression;
}

/** @internal */
function parseComparable(
  buf: InputBuffer,
  context: QueryContext,
): ComparableExpression {
  // comparable = literal / singular-query / function-expr
  const c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;

  if (c === 0x40 /*"@"*/) {
    buf.offset += 1; // "@"
    const segments = parseSegments(buf, context);
    return createQueryExpression("@", segments);
  }

  if (c === 0x24 /*"$"*/) {
    buf.offset += 1; // "$"
    const segments = parseSegments(buf, context);
    return createQueryExpression("$", segments);
  }

  if (c === 0x22 /*"\"*/ || c === 0x27 /*"'"*/) {
    const value = parseStringLiteral(buf);
    return createLiteralExpression(value);
  }

  if (c === 0x2d /*"-"*/ || isDigit(c)) {
    const value = parseNumber(buf);
    return createLiteralExpression(value);
  }

  if (!isLowercase(c)) {
    throw new QueryError("Expected comparable expression", buf);
  }

  const name = parseFunctionName(buf);
  if (name === "true") {
    return createLiteralExpression(true);
  } else if (name === "false") {
    return createLiteralExpression(false);
  } else if (name === "null") {
    return createLiteralExpression(null);
  }

  const func = context.functionExtensions?.[name];
  if (func === undefined) {
    throw new QueryError("Unknown function " + JSON.stringify(name), buf);
  }

  // function-expr = function-name "(" S [function-argument
  //                    *(S "," S function-argument)] S ")"
  return parseFunctionArguments(func, buf, context);
}

/** @internal */
function parseComparisonOperator(
  buf: InputBuffer,
): ComparisonOperator | undefined {
  // comparison-op = "==" / "!=" /
  //                 "<=" / ">=" /
  //                 "<"  / ">"
  const c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;

  if (c === 0x3d /*"="*/) {
    buf.offset += 1;
    if (
      buf.offset >= buf.limit ||
      buf.input.charCodeAt(buf.offset) !== 0x3d /*"="*/
    ) {
      throw new QueryError("Expected comparison operator", buf);
    }
    buf.offset += 1;
    return ComparisonOperator.Equal;
  }

  if (c === 0x21 /*"!"*/) {
    buf.offset += 1;
    if (
      buf.offset >= buf.limit ||
      buf.input.charCodeAt(buf.offset) !== 0x3d /*"="*/
    ) {
      throw new QueryError("Expected comparison operator", buf);
    }
    buf.offset += 1;
    return ComparisonOperator.NotEqual;
  }

  if (c === 0x3c /*"<"*/) {
    buf.offset += 1;
    if (
      buf.offset >= buf.limit ||
      buf.input.charCodeAt(buf.offset) !== 0x3d /*"="*/
    ) {
      return ComparisonOperator.LessThan;
    }
    buf.offset += 1;
    return ComparisonOperator.LessThanOrEqual;
  }

  if (c === 0x3e /*">"*/) {
    buf.offset += 1;
    if (
      buf.offset >= buf.limit ||
      buf.input.charCodeAt(buf.offset) !== 0x3d /*"="*/
    ) {
      return ComparisonOperator.GreaterThan;
    }
    buf.offset += 1;
    return ComparisonOperator.GreaterThanOrEqual;
  }

  return undefined;
}

/** @internal */
function parseFunctionArguments(
  func: FunctionExtension,
  buf: InputBuffer,
  context: QueryContext,
): FunctionExpression {
  // function-arguments = "(" S [function-argument
  //                         *(S "," S function-argument)] S ")"
  // function-argument = literal / filter-query / logical-expr / function-expr
  if (
    buf.offset >= buf.limit ||
    buf.input.charCodeAt(buf.offset) !== 0x28 /*"("*/
  ) {
    throw new QueryError("Expected function arguments", buf);
  }
  buf.offset += 1; // "("

  parseBlankSpace(buf);

  const args: Expression[] = [];
  while (true) {
    if (
      buf.offset < buf.limit &&
      buf.input.charCodeAt(buf.offset) === 0x29 /*")"*/
    ) {
      buf.offset += 1; // ")"
      break;
    }

    if (args.length !== 0) {
      if (
        buf.offset >= buf.limit ||
        buf.input.charCodeAt(buf.offset) !== 0x2c /*","*/
      ) {
        throw new QueryError("Expected comma", buf);
      }
      buf.offset += 1; // ","
      parseBlankSpace(buf);
    }

    if (args.length >= func.parameterTypes.length) {
      break;
    }

    const queryScope = context.queryScope;
    context.queryScope = QueryScope.Argument;
    let arg: Expression;
    try {
      arg = parseExpression(buf, context);
    } finally {
      context.queryScope = queryScope;
    }

    const parameterType = func.parameterTypes[args.length]!;
    checkArgumentType(parameterType, arg, buf);

    args.push(arg);

    parseBlankSpace(buf);
  }

  if (args.length !== func.parameterTypes.length) {
    throw new QueryError(
      "Expected " +
        func.parameterTypes.length +
        " arguments for function " +
        func.name +
        ", but received " +
        args.length +
        " arguments",
      buf,
    );
  }

  return createFunctionExpression(func, args);
}

/** @internal */
function checkLogicalType(expression: Expression, buf: InputBuffer): void {
  if (expression.kind === ExpressionKind.Function) {
    const resultType = expression.func.resultType;
    switch (resultType) {
      case DeclaredType.Value:
        throw new QueryError(
          "ValueType function not supported in test expression",
          buf,
        );
      case DeclaredType.Logical:
      case DeclaredType.Nodes:
        break;
      default:
        throw new TypeError("Invalid DeclaredType: " + resultType);
    }
  }
}

/** @internal */
function checkComparableType(expression: Expression, buf: InputBuffer): void {
  if (expression.kind === ExpressionKind.Function) {
    const resultType = expression.func.resultType;
    switch (resultType) {
      case DeclaredType.Value:
        break;
      case DeclaredType.Logical:
        throw new QueryError(
          "LogicalType function not supported in comparison expression",
          buf,
        );
      case DeclaredType.Nodes:
        throw new QueryError(
          "NodesType function not supported in comparison expression",
          buf,
        );
      default:
        throw new TypeError("Invalid DeclaredType: " + resultType);
    }
  }
}

/** @internal */
function checkArgumentType(
  parameterType: DeclaredType,
  expression: Expression,
  buf: InputBuffer,
): void {
  if (expression.kind === ExpressionKind.Function) {
    switch (parameterType) {
      case DeclaredType.Value:
        checkValueArgumentType(expression, buf);
        break;
      case DeclaredType.Logical:
        checkLogicalArgumentType(expression, buf);
        break;
      case DeclaredType.Nodes:
        checkNodesArgumentType(expression, buf);
        break;
      default:
        throw new TypeError("Invalid DeclaredType: " + parameterType);
    }
    return;
  }

  switch (parameterType) {
    case DeclaredType.Value:
      if (expression.kind === ExpressionKind.Query) {
        if (!isSingularQuery(expression)) {
          throw new QueryError(
            "Expected singular query expression in ValueType argument position",
            buf,
          );
        }
      } else if (expression.kind !== ExpressionKind.Literal) {
        throw new QueryError(
          "Expected literal expression in ValueType argument position",
          buf,
        );
      }
      break;
    case DeclaredType.Logical:
      if (expression.kind === ExpressionKind.Literal) {
        throw new QueryError(
          "Expected logical expression in LogicalType argument position",
          buf,
        );
      }
      break;
    case DeclaredType.Nodes:
      if (expression.kind !== ExpressionKind.Query) {
        throw new QueryError(
          "Expected query expression in NodesType argument position",
          buf,
        );
      }
      break;
    default:
      throw new TypeError("Invalid DeclaredType: " + parameterType);
  }
}

/** @internal */
function checkValueArgumentType(
  expression: FunctionExpression,
  buf: InputBuffer,
): void {
  const resultType = expression.func.resultType;
  switch (resultType) {
    case DeclaredType.Value:
      break;
    case DeclaredType.Logical:
      throw new QueryError(
        "LogicalType function not supported in ValueType argument position",
        buf,
      );
    case DeclaredType.Nodes:
      throw new QueryError(
        "NodesType function not supported in ValueType argument position",
        buf,
      );
    default:
      throw new TypeError("Invalid DeclaredType: " + resultType);
  }
}

/** @internal */
function checkLogicalArgumentType(
  expression: FunctionExpression,
  buf: InputBuffer,
): void {
  const resultType = expression.func.resultType;
  switch (resultType) {
    case DeclaredType.Value:
      throw new QueryError(
        "ValueType function not supported in LogicalType argument position",
        buf,
      );
    case DeclaredType.Logical:
    case DeclaredType.Nodes:
      break;
    default:
      throw new TypeError("Invalid DeclaredType: " + resultType);
  }
}

/** @internal */
function checkNodesArgumentType(
  expression: FunctionExpression,
  buf: InputBuffer,
): void {
  const resultType = expression.func.resultType;
  switch (resultType) {
    case DeclaredType.Value:
      throw new QueryError(
        "ValueType function not supported in NodesType argument position",
        buf,
      );
    case DeclaredType.Logical:
      throw new QueryError(
        "LogicalType function not supported in NodesType argument position",
        buf,
      );
    case DeclaredType.Nodes:
      break;
    default:
      throw new TypeError("Invalid DeclaredType: " + resultType);
  }
}

/** @internal */
function parseFunctionName(buf: InputBuffer): string {
  // function-name       = function-name-first *function-name-char
  // function-name-first = LCALPHA
  // function-name-char  = function-name-first / "_" / DIGIT
  // LCALPHA             = %x61-7A  ; "a".."z"
  const start = buf.offset;

  if (
    buf.offset >= buf.limit ||
    !isLowercase(buf.input.charCodeAt(buf.offset))
  ) {
    throw new QueryError("Expected identifier", buf);
  }
  buf.offset += 1;

  while (
    buf.offset < buf.limit &&
    isIdentifierChar(buf.input.charCodeAt(buf.offset))
  ) {
    buf.offset += 1;
  }

  return buf.input.slice(start, buf.offset);
}

/** @internal */
export function parseShorthandName(buf: InputBuffer): string {
  // member-name-shorthand = name-first *name-char
  const start = buf.offset;

  if (
    buf.offset >= buf.limit ||
    !isNameFirstChar(buf.input.charCodeAt(buf.offset))
  ) {
    throw new QueryError("Expected name", buf);
  }
  buf.offset += 1;

  while (
    buf.offset < buf.limit &&
    isNameChar(buf.input.charCodeAt(buf.offset))
  ) {
    buf.offset += 1;
  }

  return buf.input.slice(start, buf.offset);
}

/** @internal */
function parseInt(buf: InputBuffer): number {
  // int    = "0" /
  //          (["-"] DIGIT1 *DIGIT) ; - optional
  // DIGIT1 = %x31-39               ; 1-9 non-zero digit
  let c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;

  if (c === 0x30 /*"0"*/) {
    buf.offset += 1;
    return 0;
  }

  let sign: number;
  if (c === 0x2d /*"-"*/) {
    sign = -1;
    buf.offset += 1;
    c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  } else {
    sign = 1;
  }

  if (c < 0x31 /*"1"*/ || c > 0x39 /*"9"*/) {
    throw new QueryError("Expected digit", buf);
  }
  buf.offset += 1;
  let value = c - 0x30; /*"0"*/

  while (
    buf.offset < buf.limit &&
    ((c = buf.input.charCodeAt(buf.offset)), isDigit(c))
  ) {
    buf.offset += 1;
    value = value * 10 + (c - 0x30) /*"0"*/;
  }

  value *= sign;
  return value;
}

/** @internal */
function parseNumber(buf: InputBuffer): number {
  // number = (int / "-0") [ frac ] [ exp ] ; decimal number
  const start = buf.offset;
  let c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;

  if (c === 0x2d /*"-"*/) {
    buf.offset += 1;
    c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  }

  if (c === 0x30 /*"0"*/) {
    buf.offset += 1;
  } else if (c < 0x31 /*"1"*/ || c > 0x39 /*"9"*/) {
    throw new QueryError("Expected digit", buf);
  } else {
    buf.offset += 1;

    while (
      buf.offset < buf.limit &&
      isDigit(buf.input.charCodeAt(buf.offset))
    ) {
      buf.offset += 1;
    }

    // frac = "." 1*DIGIT ; decimal fraction
    if (
      buf.offset < buf.limit &&
      buf.input.charCodeAt(buf.offset) === 0x2e /*"."*/
    ) {
      buf.offset += 1; // "."

      if (
        buf.offset >= buf.limit ||
        !isDigit(buf.input.charCodeAt(buf.offset))
      ) {
        throw new QueryError("Expected fractional part", buf);
      }
      buf.offset += 1; // digit

      while (
        buf.offset < buf.limit &&
        isDigit(buf.input.charCodeAt(buf.offset))
      ) {
        buf.offset += 1;
      }
    }

    // exp = "e" [ "-" / "+" ] 1*DIGIT ; decimal exponent
    if (
      buf.offset < buf.limit &&
      (buf.input.charCodeAt(buf.offset) === 0x45 /*"E"*/ ||
        buf.input.charCodeAt(buf.offset) === 0x65) /*"e"*/
    ) {
      buf.offset += 1; // "E" or "e"

      if (buf.input.charCodeAt(buf.offset) === 0x2b /*"+"*/) {
        buf.offset += 1; // "+"
      } else if (buf.input.charCodeAt(buf.offset) === 0x2d /*"-"*/) {
        buf.offset += 1; // "-"
      }

      if (
        buf.offset >= buf.limit ||
        !isDigit(buf.input.charCodeAt(buf.offset))
      ) {
        throw new QueryError("Expected exponent part", buf);
      }
      buf.offset += 1; // digit

      while (
        buf.offset < buf.limit &&
        isDigit(buf.input.charCodeAt(buf.offset))
      ) {
        buf.offset += 1;
      }
    }
  }

  return Number(buf.input.slice(start, buf.offset));
}

/** @internal */
function parseStringLiteral(buf: InputBuffer): string {
  let result = "";

  // string-literal = %x22 *double-quoted %x22 / ; "string"
  //                  %x27 *single-quoted %x27   ; 'string'
  let c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  let quote: number;
  switch (c) {
    case 0x22: // "\""
      buf.offset += 1;
      quote = 0x22;
      break;
    case 0x27: // "'"
      buf.offset += 1;
      quote = 0x27;
      break;
    default:
      throw new QueryError("Expected string literal", buf);
  }

  // double-quoted = unescaped /
  //                 %x27      / ; '
  //                 ESC %x22  / ; \"
  //                 ESC escapable
  // single-quoted = unescaped /
  //                 %x22      / ; "
  //                 ESC %x27  / ; \'
  //                 ESC escapable
  while (buf.offset < buf.limit) {
    c = buf.input.charCodeAt(buf.offset);
    if (c === quote) {
      buf.offset += 1;
      break;
    }

    if (
      isUnescapedStringChar(c) ||
      (quote === 0x22 /*"\""*/ && c === 0x27) /*"'"*/ ||
      (quote === 0x27 /*"'"*/ && c === 0x22) /*"\""*/
    ) {
      result += String.fromCharCode(c);
      buf.offset += 1;
      continue;
    }

    // ESC = %x5C ; \ backslash
    if (c === 0x5c /*"\\"*/) {
      buf.offset += 1;

      c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
      if (
        (quote === 0x22 /*"\""*/ && c === 0x22) /*"\""*/ ||
        (quote === 0x27 /*"'"*/ && c === 0x27) /*"'"*/
      ) {
        buf.offset += 1; // "\"" or "'"
        result += String.fromCharCode(c);
        continue;
      }

      // escapable = %x62 / ; b BS backspace U+0008
      //             %x66 / ; f FF form feed U+000C
      //             %x6E / ; n LF line feed U+000A
      //             %x72 / ; r CR carriage return U+000D
      //             %x74 / ; t HT horizontal tab U+0009
      //             "/"  / ; / slash (solidus) U+002F
      //             "\"  / ; \ backslash (reverse solidus) U+005C
      //             (%x75 hexchar) ; uXXXX U+XXXX
      switch (c) {
        case 0x62: // "b"
          buf.offset += 1;
          result += "\b";
          continue;
        case 0x66: // "f"
          buf.offset += 1;
          result += "\f";
          continue;
        case 0x6e: // "n"
          buf.offset += 1;
          result += "\n";
          continue;
        case 0x72: // "r"
          buf.offset += 1;
          result += "\r";
          continue;
        case 0x74: // "t"
          buf.offset += 1;
          result += "\t";
          continue;
        case 0x2f: // "/"
          buf.offset += 1;
          result += "/";
          continue;
        case 0x5c: // "\\"
          buf.offset += 1;
          result += "\\";
          continue;
        case 0x75: // "u"
          buf.offset += 1;
          break;
        default:
          throw new QueryError("Invalid escape sequence", buf);
      }

      // hexchar        = non-surrogate /
      //                  (high-surrogate "\" %x75 low-surrogate)
      // non-surrogate  = ((DIGIT / "A"/"B"/"C" / "E"/"F") 3HEXDIG) /
      //                  ("D" %x30-37 2HEXDIG )
      // high-surrogate = "D" ("8"/"9"/"A"/"B") 2HEXDIG
      // low-surrogate  = "D" ("C"/"D"/"E"/"F") 2HEXDIG
      const c0 = parseHexCodePoint(buf);
      if (c0 < 0xd800 || c0 > 0xdfff) {
        buf.offset += 4; // non-surrogate
        result += String.fromCharCode(c0);
        continue;
      } else if (c0 >= 0xd800 && c0 <= 0xdbff) {
        buf.offset += 4; // high-surrogate

        if (
          buf.offset + 2 >= buf.limit ||
          buf.input.charCodeAt(buf.offset) !== 0x5c || // "\"
          buf.input.charCodeAt(buf.offset + 1) !== 0x75 // "u"
        ) {
          throw new QueryError("Expected low surrogate", buf);
        }
        buf.offset += 2; // "\\u"

        const c1 = parseHexCodePoint(buf);
        if (c1 < 0xdc00 || c1 > 0xdfff) {
          throw new QueryError("Invalid low surrogate", buf);
        }
        buf.offset += 4; // low-surrogate

        result += String.fromCharCode(c0, c1);
        continue;
      } else {
        throw new QueryError("Unexpected low surrogate", buf);
      }
    }

    throw new QueryError("Invalid string literal character", buf);
  }

  return result;
}

/** @internal */
function parseHexCodePoint(buf: InputBuffer): number {
  const c0 = parseHexChar(buf);
  const c1 = parseHexChar(buf);
  const c2 = parseHexChar(buf);
  const c3 = parseHexChar(buf);
  return (c0 << 12) | (c1 << 8) | (c2 << 4) | c3;
}

/** @internal */
function parseHexChar(buf: InputBuffer): number {
  const c = buf.offset < buf.limit ? buf.input.charCodeAt(buf.offset) : -1;
  if (c >= 0x30 /*"0"*/ && c <= 0x39 /*"9"*/) {
    buf.offset += 1;
    return c - 0x30 /*"0"*/;
  } else if (c >= 0x41 /*"A"*/ && c <= 0x46 /*"F"*/) {
    buf.offset += 1;
    return c - 0x37 /*"7"*/;
  } else if (c >= 0x61 /*"a"*/ && c <= 0x66 /*"f"*/) {
    buf.offset += 1;
    return c - 0x57 /*"W"*/;
  }
  throw new QueryError("Expected hex digit", buf);
}

/** @internal */
export function parseBlankSpace(buf: InputBuffer): void {
  // S = *B ; optional blank space
  while (
    buf.offset < buf.limit &&
    isSpaceChar(buf.input.charCodeAt(buf.offset))
  ) {
    buf.offset += 1;
  }
}

/** @internal */
function isIdentifierChar(c: number): boolean {
  return isLowercase(c) || c === 0x5f /*"_"*/ || isDigit(c);
}

/** @internal */
export function isNameChar(c: number): boolean {
  // name-char = name-first / DIGIT
  return isNameFirstChar(c) || isDigit(c);
}

/** @internal */
export function isNameFirstChar(c: number): boolean {
  // name-first = ALPHA / "_"
  return isAlpha(c) || c === 0x5f /*"_"*/;
}

/** @internal */
function isAlpha(c: number): boolean {
  // ALPHA = %x41-5A / %x61-7A ; A-Z / a-z
  return isUppercase(c) || isLowercase(c);
}

/** @internal */
function isUppercase(c: number): boolean {
  return c >= 0x41 /*"A"*/ && c <= 0x5a /*"Z"*/;
}

/** @internal */
function isLowercase(c: number): boolean {
  return c >= 0x61 /*"a"*/ && c <= 0x7a /*"z"*/;
}

/** @internal */
function isDigit(c: number): boolean {
  return c >= 0x30 /*"0"*/ && c <= 0x39 /*"9"*/;
}

/** @internal */
export function isSpaceChar(c: number): boolean {
  // B = %x20 / ; Space
  //     %x09 / ; Horizontal tab
  //     %x0A / ; Line feed or New line
  //     %x0D   ; Carriage return
  return (
    c === 0x20 || // " "
    c === 0x09 || // "\t"
    c === 0x0a || // "\n"
    c === 0x0d // "\r"
  );
}

/** @internal */
export function isUnescapedStringChar(c: number): boolean {
  // unescaped = %x20-21 / ; see RFC 8259
  //                ; omit 0x22 "
  //             %x23-26 /
  //                ; omit 0x27 '
  //             %x28-5B /
  //                ; omit 0x5C \
  //             %x5D-D7FF /
  //                ; skip surrogate code points
  //             %xE000-10FFFF
  return (
    (c >= 0x20 && c <= 0x21) ||
    (c >= 0x23 && c <= 0x26) ||
    (c >= 0x28 && c <= 0x5b) ||
    (c >= 0x5d && c <= 0xd7ff) ||
    (c >= 0xe000 && c <= 0x10ffff)
  );
}
