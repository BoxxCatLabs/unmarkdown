/**
 * Input guards and line-ending normalization (CRLF / lone CR → LF).
 * Runs first in every pipeline.
 */

/** True when `input` is a string with at least one non-whitespace char. */
export function isUsableInput(input: unknown): input is string {
  return typeof input === 'string' && input.trim() !== ''
}

export function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n?/g, '\n')
}
