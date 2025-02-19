import type { Segment } from "./segment.ts";
import { isSingularSegment } from "./segment.ts";
import type { QueryExpression } from "./expression.ts";

/**
 * An [RFC 9535](https://datatracker.ietf.org/doc/html/rfc9535) JSONPath
 * query expression.
 *
 * @see [RFC 9535 §2.1](https://datatracker.ietf.org/doc/html/rfc9535#section-2.1)
 * @category Query
 */
export interface Query {
  readonly segments: readonly Segment[];
}

/**
 * Creates a JSONPath query expression.
 *
 * @category Query
 */
export function createQuery(segments: readonly Segment[]): Query {
  return { segments };
}

/**
 * Returns `true` if the given query produces a nodelist containing
 * at most one node, regardless of the input value.
 *
 * @category Query
 */
export function isSingularQuery(query: Query | QueryExpression): boolean {
  return query.segments.every(isSingularSegment);
}
