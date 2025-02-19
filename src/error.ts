import type { ProcessingErrorOptions } from "tool-json";
import { ProcessingError } from "tool-json";

/**
 * Initialization options for JSONPath parsing errors.
 *
 * @category Parse
 */
export interface QueryErrorOptions extends ProcessingErrorOptions {
  /**
   * The input that caused the error.
   */
  input?: string | undefined;

  /**
   * The position in the input where the error occurred.
   */
  offset?: number | undefined;
}

/**
 * An error that occurs while parsing an RFC 9535 JSONPath expression.
 *
 * @category Parse
 */
export class QueryError extends ProcessingError {
  /**
   * The input that caused the error.
   */
  input?: string | undefined;

  /**
   * The position in the input where the error occurred.
   */
  offset?: number | undefined;

  constructor(message?: string, options?: QueryErrorOptions) {
    super(message, options);
    this.input = options?.input;
    this.offset = options?.offset;
  }
}
