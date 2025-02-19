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
  Expression,
  OrExpression,
  AndExpression,
  ComparisonExpression,
  NotExpression,
  QueryExpression,
  LiteralExpression,
  FunctionExpression,
} from "./expression.ts";
import {
  ExpressionKind,
  ComparisonOperator,
  getExpressionPrecedence,
} from "./expression.ts";
import { isNameFirstChar, isNameChar, isUnescapedStringChar } from "./parse.ts";

/**
 * Serializes a JSONPath query expression as an RFC 9535 string.
 *
 * @category Format
 */
export function formatQuery(query: Query): string {
  let output = "$";
  for (const segment of query.segments) {
    output += formatSegment(segment);
  }
  return output;
}

/**
 * Serializes a JSONPath segment as an RFC 9535 string.
 *
 * @category Format
 */
export function formatSegment(segment: Segment): string {
  const kind = segment.kind;
  switch (kind) {
    case SegmentKind.Child:
      return formatChildSegment(segment);
    case SegmentKind.Descendant:
      return formatDescendantSegment(segment);
    default:
      throw new TypeError("Invalid SegmentKind: " + kind);
  }
}

/**
 * Serializes a child segment as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatChildSegment(segment: ChildSegment): string {
  if (segment.selectors.length === 1) {
    const selector = segment.selectors[0]!;
    if (
      selector.kind === SelectorKind.Name &&
      isValidShorthandName(selector.name)
    ) {
      return "." + selector.name;
    } else if (selector.kind === SelectorKind.Wildcard) {
      return ".*";
    }
  }

  let output = "[";
  for (let i = 0; i < segment.selectors.length; i += 1) {
    if (i !== 0) {
      output += ", ";
    }
    output += formatSelector(segment.selectors[i]!);
  }
  output += "]";
  return output;
}

/**
 * Serializes a descendant segment as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatDescendantSegment(segment: DescendantSegment): string {
  if (segment.selectors.length === 1) {
    const selector = segment.selectors[0]!;
    if (
      selector.kind === SelectorKind.Name &&
      isValidShorthandName(selector.name)
    ) {
      return ".." + selector.name;
    } else if (selector.kind === SelectorKind.Wildcard) {
      return "..*";
    }
  }

  let output = "..[";
  for (let i = 0; i < segment.selectors.length; i += 1) {
    if (i !== 0) {
      output += ", ";
    }
    output += formatSelector(segment.selectors[i]!);
  }
  output += "]";
  return output;
}

/**
 * Serializes a JSONPath selector as an RFC 9535 string.
 *
 * @category Format
 */
export function formatSelector(selector: Selector): string {
  const kind = selector.kind;
  switch (kind) {
    case SelectorKind.Name:
      return formatNameSelector(selector);
    case SelectorKind.Wildcard:
      return formatWildcardSelector(selector);
    case SelectorKind.Index:
      return formatIndexSelector(selector);
    case SelectorKind.Slice:
      return formatSliceSelector(selector);
    case SelectorKind.Filter:
      return formatFilterSelector(selector);
    default:
      throw new TypeError("Invalid SelectorKind: " + kind);
  }
}

/**
 * Serializes a name selector as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatNameSelector(selector: NameSelector): string {
  return formatStringLiteral(selector.name);
}

/**
 * Serializes a wildcard selector as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatWildcardSelector(selector: WildcardSelector): string {
  return "*";
}

/**
 * Serializes an index selector as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatIndexSelector(selector: IndexSelector): string {
  return String(selector.index);
}

/**
 * Serializes a slice selector as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatSliceSelector(selector: SliceSelector): string {
  let output = "";
  if (selector.start !== undefined) {
    output += String(selector.start);
  }
  output += ":";
  if (selector.end !== undefined) {
    output += String(selector.end);
  }
  if (selector.step !== undefined) {
    output += ":" + String(selector.step);
  }
  return output;
}

/**
 * Serializes a filter selector as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatFilterSelector(selector: FilterSelector): string {
  return "?" + formatExpression(selector.expression);
}

/**
 * Serializes a JSONPath expression as an RFC 9535 string.
 *
 * @category Format
 */
export function formatExpression(expression: Expression): string {
  const kind = expression.kind;
  switch (kind) {
    case ExpressionKind.Or:
      return formatOrExpression(expression);
    case ExpressionKind.And:
      return formatAndExpression(expression);
    case ExpressionKind.Comparison:
      return formatComparisonExpression(expression);
    case ExpressionKind.Not:
      return formatNotExpression(expression);
    case ExpressionKind.Query:
      return formatQueryExpression(expression);
    case ExpressionKind.Literal:
      return formatLiteralExpression(expression);
    case ExpressionKind.Function:
      return formatFunctionExpression(expression);
    default:
      throw new TypeError("Invalid ExpressionKind: " + kind);
  }
}

/**
 * Serializes an OR expression as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatOrExpression(expression: OrExpression): string {
  let output = "";
  for (let i = 0; i < expression.operands.length; i += 1) {
    if (i !== 0) {
      output += " || ";
    }
    output += parenthesizeExpression(expression.operands[i]!, 1);
  }
  return output;
}

/**
 * Serializes an AND expression as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatAndExpression(expression: AndExpression): string {
  let output = "";
  for (let i = 0; i < expression.operands.length; i += 1) {
    if (i !== 0) {
      output += " && ";
    }
    output += parenthesizeExpression(expression.operands[i]!, 2);
  }
  return output;
}

/**
 * Serializes a comparison expression as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatComparisonExpression(
  expression: ComparisonExpression,
): string {
  let output = parenthesizeExpression(expression.lhs, 3);

  const operator = expression.operator;
  switch (operator) {
    case ComparisonOperator.Equal:
      output += " == ";
      break;
    case ComparisonOperator.NotEqual:
      output += " != ";
      break;
    case ComparisonOperator.LessThan:
      output += " < ";
      break;
    case ComparisonOperator.LessThanOrEqual:
      output += " <= ";
      break;
    case ComparisonOperator.GreaterThan:
      output += " > ";
      break;
    case ComparisonOperator.GreaterThanOrEqual:
      output += " >= ";
      break;
    default:
      throw new TypeError("Invalid ComparisonOperator: " + operator);
  }

  output += parenthesizeExpression(expression.rhs, 3);
  return output;
}

/**
 * Serializes a NOT expression as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatNotExpression(expression: NotExpression): string {
  return "!" + parenthesizeExpression(expression.operand, 4);
}

/**
 * Serializes a query expression as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatQueryExpression(expression: QueryExpression): string {
  let output = expression.identifier;
  for (const segment of expression.segments) {
    output += formatSegment(segment);
  }
  return output;
}

/**
 * Serializes a literal expression as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatLiteralExpression(expression: LiteralExpression): string {
  const value = expression.value;
  if (typeof value === "string") {
    return formatStringLiteral(value);
  }
  return JSON.stringify(value);
}

/**
 * Serializes a function expression as an RFC 9535 string.
 *
 * @category Format
 * @internal
 */
export function formatFunctionExpression(
  expression: FunctionExpression,
): string {
  let output = expression.func.name;
  output += "(";
  for (let i = 0; i < expression.args.length; i += 1) {
    if (i !== 0) {
      output += ", ";
    }
    output += formatExpression(expression.args[i]!);
  }
  output += ")";
  return output;
}

/** @internal */
function parenthesizeExpression(
  expression: Expression,
  requiredPrecedence: number,
): string {
  let output = "";
  const precedence = getExpressionPrecedence(expression);
  if (precedence < requiredPrecedence) {
    output = "(";
  }
  output += formatExpression(expression);
  if (precedence < requiredPrecedence) {
    output += ")";
  }
  return output;
}

/** @internal */
function formatStringLiteral(value: string): string {
  let result = "'";

  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (isUnescapedStringChar(c) || c === 0x22 /*"\""*/) {
      result += value[i]!;
      continue;
    }

    switch (c) {
      case 0x27: // "'"
        result += "\\'";
        continue;
      case 0x08: // "\b"
        result += "\\b";
        continue;
      case 0x0c: // "\f"
        result += "\\f";
        continue;
      case 0x0a: // "\n"
        result += "\\n";
        continue;
      case 0x0d: // "\r"
        result += "\\r";
        continue;
      case 0x09: // "\t"
        result += "\\t";
        continue;
      case 0x2f: // "/"
        result += "\\/";
        continue;
      case 0x5c: // "\\"
        result += "\\\\";
        continue;
      default: // UTF-16 code unit
        result += "\\u" + c.toString(16).padStart(4, "0");
        continue;
    }
  }

  result += "'";
  return result;
}

/** @internal */
function isValidShorthandName(name: string): boolean {
  if (name.length === 0 || !isNameFirstChar(name.charCodeAt(0))) {
    return false;
  }
  for (let i = 1; i < name.length; i += 1) {
    if (!isNameChar(name.charCodeAt(i))) {
      return false;
    }
  }
  return true;
}
