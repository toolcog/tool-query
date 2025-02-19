import type { Expression } from "./expression.ts";

/**
 * The syntax kind of a selector.
 *
 * @category Selector
 */
export type SelectorKind = (typeof SelectorKind)[keyof typeof SelectorKind];

export const SelectorKind = {
  Name: 3,
  Wildcard: 4,
  Index: 5,
  Slice: 6,
  Filter: 7,
} as const;

/**
 * A single item within a segment that takes the input value and produces
 * a nodelist consisting of child nodes of the input value.
 *
 * @see [RFC 9535 §2.3](https://datatracker.ietf.org/doc/html/rfc9535#section-2.3)
 * @category Selector
 */
export type Selector =
  | NameSelector
  | WildcardSelector
  | IndexSelector
  | SliceSelector
  | FilterSelector;

/**
 * Returns `true` if the given selector produces a nodelist containing
 * at most one node, regardless of the input value.
 *
 * @category Selector
 */
export function isSingularSelector(selector: Selector): boolean {
  switch (selector.kind) {
    case SelectorKind.Name:
    case SelectorKind.Index:
      return true;
    default:
      return false;
  }
}

/**
 * A selector that matches a member name.
 *
 * @category Selector
 */
export interface NameSelector {
  readonly kind: typeof SelectorKind.Name;

  readonly name: string;
}

/**
 * Creates a name selector.
 *
 * @category Selector
 */
export function createNameSelector(name: string): NameSelector {
  return { kind: SelectorKind.Name, name };
}

/**
 * A selector that matches any member.
 *
 * @category Selector
 */
export interface WildcardSelector {
  readonly kind: typeof SelectorKind.Wildcard;
}

/**
 * Creates a wildcard selector.
 *
 * @category Selector
 */
export function createWildcardSelector(): WildcardSelector {
  return { kind: SelectorKind.Wildcard };
}

/**
 * A selector that matches an array index.
 *
 * @category Selector
 */
export type ArraySelector = IndexSelector | SliceSelector;

/**
 * A selector that matches an array index.
 *
 * @category Selector
 */
export interface IndexSelector {
  readonly kind: typeof SelectorKind.Index;

  readonly index: number;
}

/**
 * Creates an index selector.
 *
 * @category Selector
 */
export function createIndexSelector(index: number): IndexSelector {
  return { kind: SelectorKind.Index, index };
}

/**
 * A selector that matches a slice of an array.
 *
 * @category Selector
 */
export interface SliceSelector {
  readonly kind: typeof SelectorKind.Slice;

  readonly start: number | undefined;

  readonly end: number | undefined;

  readonly step: number | undefined;
}

/**
 * Creates a slice selector.
 *
 * @category Selector
 */
export function createSliceSelector(
  start: number | undefined,
  end: number | undefined,
  step: number | undefined,
): SliceSelector {
  return { kind: SelectorKind.Slice, start, end, step };
}

/**
 * A selector that matches a filter expression.
 *
 * @category Selector
 */
export interface FilterSelector {
  readonly kind: typeof SelectorKind.Filter;

  readonly expression: Expression;
}

/**
 * Creates a filter selector.
 *
 * @category Selector
 */
export function createFilterSelector(expression: Expression): FilterSelector {
  return { kind: SelectorKind.Filter, expression };
}
