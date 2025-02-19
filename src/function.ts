import { isString, isArray, isObject, unicodeLength } from "tool-json";
import type {
  ValueType,
  LogicalType,
  NodesType,
  ExpressionType,
} from "./expression.ts";
import { DeclaredType } from "./expression.ts";
import type { QueryContext } from "./context.ts";

/**
 * A JSONPath function extension.
 *
 * @see [RFC 9535 §2.4](https://datatracker.ietf.org/doc/html/rfc9535#section-2.4)
 * @category Function
 */
export type FunctionExtension =
  | ValueFunctionExtension
  | LogicalFunctionExtension
  | NodesFunctionExtension;

/**
 * A JSONPath function extension that returns a value or `undefined`.
 *
 * @category Function
 */
export interface ValueFunctionExtension {
  readonly name: string;

  readonly parameterTypes: readonly DeclaredType[];

  readonly resultType: typeof DeclaredType.Value;

  readonly evaluate: (
    args: readonly ExpressionType[],
    context: QueryContext,
  ) => ValueType;
}

/**
 * A JSONPath function extension that returns a logical value.
 *
 * @category Function
 */
export interface LogicalFunctionExtension {
  readonly name: string;

  readonly parameterTypes: readonly DeclaredType[];

  readonly resultType: typeof DeclaredType.Logical;

  readonly evaluate: (
    args: readonly ExpressionType[],
    context: QueryContext,
  ) => LogicalType;
}

/**
 * A JSONPath function extension that returns a nodelist.
 *
 * @category Function
 */
export interface NodesFunctionExtension {
  readonly name: string;

  readonly parameterTypes: readonly DeclaredType[];

  readonly resultType: typeof DeclaredType.Nodes;

  readonly evaluate: (
    args: readonly ExpressionType[],
    context: QueryContext,
  ) => NodesType;
}

/**
 * The `length()` function extension provides a way to compute the length
 * of a value and make that available for further processing in the filter
 * expression:
 *
 * ```
 * $[?length(@.authors) >= 5]
 * ```
 *
 * Its only argument is an instance of ValueType (possibly taken from a
 * singular query, as in the example above). The result is also an instance
 * of ValueType: an unsigned integer or the special result Nothing.
 *
 * - If the argument value is a string, the result is the number of Unicode
 *   scalar values in the string.
 * - If the argument value is an array, the result is the number of elements
 *   in the array.
 * - If the argument value is an object, the result is the number of members
 *   in the object.
 * - For any other argument value, the result is the special result Nothing.
 *
 * @see [RFC 9535 §2.4.4](https://datatracker.ietf.org/doc/html/rfc9535#section-2.4.4)
 * @category Function
 */
export const lengthFunction = {
  name: "length",
  parameterTypes: [DeclaredType.Value],
  resultType: DeclaredType.Value,
  evaluate(args: readonly ExpressionType[]): ValueType {
    const value = args[0];
    if (isString(value)) {
      return unicodeLength(value);
    } else if (isArray(value)) {
      return value.length;
    } else if (isObject(value)) {
      return Object.keys(value).length;
    }
    return undefined;
  },
} as const satisfies ValueFunctionExtension;

/**
 * The `count()` function extension provides a way to obtain the number of
 * nodes in a nodelist and make that available for further processing in
 * the filter expression:
 *
 * ```
 * $[?count(@.*.author) >= 5]
 * ```
 *
 * Its only argument is a nodelist. The result is a value (an unsigned integer)
 * that gives the number of nodes in the nodelist.
 *
 * Notes:
 *
 * - There is no deduplication of the nodelist.
 * - The number of nodes in the nodelist is counted independent of their values
 *   or any children they may have, e.g., the count of a non-empty singular
 *   nodelist such as `count(@)` is always `1`.
 *
 * @see [RFC 9535 §2.4.5](https://datatracker.ietf.org/doc/html/rfc9535#section-2.4.5)
 * @category Function
 */
export const countFunction = {
  name: "count",
  parameterTypes: [DeclaredType.Nodes],
  resultType: DeclaredType.Value,
  evaluate(args: readonly ExpressionType[]): ValueType {
    const nodes = args[0] as NodesType;
    return nodes.length;
  },
} as const satisfies ValueFunctionExtension;

/**
 * The `match()` function extension provides a way to check whether
 * the entirety of a given string matches a given regular expression,
 * which is in the form described in RFC 9485.
 *
 * ```
 * $[?match(@.date, "1974-05-..")]
 * ```
 *
 * Its arguments are instances of ValueType (possibly taken from a singular
 * query, as for the first argument in the example above). If the first
 * argument is not a string or the second argument is not a string conforming
 * to RFC 9485, the result is LogicalFalse. Otherwise, the string that is the
 * first argument is matched against the I-Regexp contained in the string that
 * is the second argument; the result is LogicalTrue if the string matches the
 * I-Regexp and is LogicalFalse otherwise.
 *
 * @see [RFC 9535 §2.4.6](https://datatracker.ietf.org/doc/html/rfc9535#section-2.4.6)
 * @category Function
 */
export const matchFunction = {
  name: "match",
  parameterTypes: [DeclaredType.Value, DeclaredType.Value],
  resultType: DeclaredType.Logical,
  evaluate(args: readonly ExpressionType[]): LogicalType {
    const value = args[0];
    const regex = args[1];
    if (!isString(value) || !isString(regex)) {
      return false;
    }
    return new RegExp("^(?:" + regex + ")$").test(value);
  },
} as const satisfies LogicalFunctionExtension;

/**
 * The `search()` function extension provides a way to check whether a given
 * string contains a substring that matches a given regular expression,
 * which is in the form described in RFC 9485.
 *
 * ```
 * $[?search(@.author, "[BR]ob")]
 * ```
 *
 * Its arguments are instances of ValueType (possibly taken from a singular
 * query, as for the first argument in the example above). If the first
 * argument is not a string or the second argument is not a string conforming
 * to RFC 9485, the result is LogicalFalse. Otherwise, the string that is the
 * first argument is searched for a substring that matches the I-Regexp
 * contained in the string that is the second argument; the result is
 * LogicalTrue if at least one such substring exists and is LogicalFalse
 * otherwise.
 *
 * @see [RFC 9535 §2.4.7](https://datatracker.ietf.org/doc/html/rfc9535#section-2.4.7)
 * @category Function
 */
export const searchFunction = {
  name: "search",
  parameterTypes: [DeclaredType.Value, DeclaredType.Value],
  resultType: DeclaredType.Logical,
  evaluate(args: readonly ExpressionType[]): LogicalType {
    const value = args[0];
    const regex = args[1];
    if (!isString(value) || !isString(regex)) {
      return false;
    }
    return new RegExp(regex).test(value);
  },
} as const satisfies LogicalFunctionExtension;

/**
 * The `value()` function extension provides a way to convert an instance
 * of NodesType to a value and make that available for further processing
 * in the filter expression:
 *
 * ```
 * $[?value(@..color) == "red"]
 * ```
 *
 * Its only argument is an instance of NodesType (possibly taken from a
 * filter-query, as in the example above). The result is an instance of
 * ValueType.
 *
 * - If the argument contains a single node, the result is the value
 *   of the node.
 * - If the argument is the empty nodelist or contains multiple nodes,
 *   the result is Nothing.
 *
 * Note: A singular query may be used anywhere where a ValueType is expected,
 * so there is no need to use the value() function extension with a singular
 * query.
 *
 * @see [RFC 9535 §2.4.8](https://datatracker.ietf.org/doc/html/rfc9535#section-2.4.8)
 * @category Function
 */
export const valueFunction = {
  name: "value",
  parameterTypes: [DeclaredType.Nodes],
  resultType: DeclaredType.Value,
  evaluate(args: readonly ExpressionType[]): ValueType {
    const nodes = args[0] as NodesType;
    return singularValue(nodes);
  },
} as const satisfies ValueFunctionExtension;

/**
 * Returns the singular node in the given nodelist, or `undefined`
 * if the nodelist is empty or contains more than one node.
 *
 * @category Function
 * @internal
 */
export function singularValue(nodes: NodesType): ValueType {
  if (nodes.length === 1) {
    return nodes[0];
  }
  return undefined;
}

/**
 * The intrinsic function extensions defined in RFC 9535.
 *
 * @category Function
 */
export const intrinsicFunctions = {
  [lengthFunction.name]: lengthFunction,
  [countFunction.name]: countFunction,
  [matchFunction.name]: matchFunction,
  [searchFunction.name]: searchFunction,
  [valueFunction.name]: valueFunction,
} as const;
