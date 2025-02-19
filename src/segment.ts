import type { Selector } from "./selector.ts";
import { isSingularSelector } from "./selector.ts";

/**
 * The syntax kind of a segment.
 *
 * @category Segment
 */
export type SegmentKind = (typeof SegmentKind)[keyof typeof SegmentKind];

export const SegmentKind = {
  Child: 1,
  Descendant: 2,
} as const;

/**
 * One of the constructs that selects children ([&lt;selectors&gt;])
 * or descendants (..⁠[&lt;selectors&gt;]) of an input value.
 *
 * @category Segment
 * @see [RFC 9535 §2.5](https://datatracker.ietf.org/doc/html/rfc9535#section-2.5)
 */
export type Segment = ChildSegment | DescendantSegment;

/**
 * Returns `true` if the given segment produces a nodelist containing
 * at most one node, regardless of the input value.
 *
 * @category Segment
 */
export function isSingularSegment(segment: Segment): boolean {
  return (
    segment.kind === SegmentKind.Child &&
    segment.selectors.length === 1 &&
    isSingularSelector(segment.selectors[0]!)
  );
}

/**
 * A segment that selects children ([&lt;selectors&gt;]) of an input value.
 *
 * @category Segment
 */
export interface ChildSegment {
  readonly kind: typeof SegmentKind.Child;

  readonly selectors: readonly Selector[];
}

/**
 * Creates a child segment.
 *
 * @category Segment
 */
export function createChildSegment(
  selectors: readonly Selector[],
): ChildSegment {
  return { kind: SegmentKind.Child, selectors };
}

/**
 * A segment that selects descendants (..⁠[&lt;selectors&gt;]) of an input value.
 *
 * @category Segment
 */
export interface DescendantSegment {
  readonly kind: typeof SegmentKind.Descendant;

  readonly selectors: readonly Selector[];
}

/**
 * Creates a descendant segment.
 *
 * @category Segment
 */
export function createDescendantSegment(
  selectors: readonly Selector[],
): DescendantSegment {
  return { kind: SegmentKind.Descendant, selectors };
}
