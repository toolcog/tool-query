import type { Context, ContextOptions } from "tool-json";
import { isArray, initContext, createContext } from "tool-json";
import type { FunctionExtension } from "./function.ts";
import { intrinsicFunctions } from "./function.ts";

/**
 * The lexical scope of a JSONPath query expression.
 *
 * @internal
 */
export type QueryScope = (typeof QueryScope)[keyof typeof QueryScope];

/** @internal */
export const QueryScope = {
  Expression: 1,
  Argument: 2,
} as const;

/**
 * A context for JSONPath query evaluation.
 *
 * @category Context
 */
export interface QueryContext extends Context {
  /**
   * Supported JSONPath function extensions.
   */
  functionExtensions:
    | { readonly [name: string]: FunctionExtension }
    | undefined;

  /**
   * The root node for JSONPath query evaluation.
   */
  queryArgument: unknown | undefined;

  /**
   * The immediate expression scope of the JSONPath query parser.
   */
  queryScope: QueryScope | undefined;
}

/**
 * Options for configuring a query context.
 *
 * @category Context
 */
export interface QueryContextOptions extends ContextOptions {
  /**
   * Additional JSONPath function extensions to support.
   */
  functionExtensions?:
    | readonly FunctionExtension[]
    | { readonly [name: string]: FunctionExtension }
    | undefined;

  /**
   * The root node for JSONPath query evaluation.
   */
  queryArgument?: unknown | undefined;
}

/**
 * Initializes a context for JSONPath query evaluation.
 *
 * @category Context
 */
export function initQueryContext(
  context: Context & Partial<QueryContext>,
  options?: QueryContextOptions,
): QueryContext {
  // Minimize mixin shape variation.
  if (!("functionExtensions" in context)) {
    context.functionExtensions = intrinsicFunctions;
  }
  if (!("queryArgument" in context)) {
    context.queryArgument = undefined;
  }
  if (!("queryScope" in context)) {
    context.queryScope = undefined;
  }

  // Configure function extensions.
  if (options?.functionExtensions !== undefined) {
    if (isArray(options.functionExtensions)) {
      const functionExtensions: Record<string, FunctionExtension> = {
        ...context.functionExtensions,
      };
      for (const functionExtension of options.functionExtensions) {
        functionExtensions[functionExtension.name] = functionExtension;
      }
      context.functionExtensions = functionExtensions;
    } else if (context.functionExtensions !== undefined) {
      context.functionExtensions = {
        ...context.functionExtensions,
        ...options.functionExtensions,
      };
    } else {
      context.functionExtensions = options.functionExtensions;
    }
  }

  // Configure the query argument.
  if (options?.queryArgument !== undefined) {
    context.queryArgument = options.queryArgument;
  }

  return context as QueryContext;
}

/**
 * Creates a new shared context for JSONPath query evaluation.
 *
 * @category Context
 */
export function createQueryContext(
  options?: QueryContextOptions,
): QueryContext {
  return initQueryContext(createContext(options), options);
}

/**
 * Initializes a query context with the specified options,
 * returning `options` itself if it's already a query context.
 *
 * @category Context
 */
export function coerceQueryContext(
  options?: QueryContextOptions | QueryContext,
): QueryContext {
  if (options !== undefined && "queryScope" in options) {
    return options;
  }

  return initQueryContext(initContext({}, options), options);
}
