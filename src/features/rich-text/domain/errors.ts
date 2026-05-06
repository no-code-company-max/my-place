/**
 * Errores estructurados del slice `rich-text`.
 *
 * Sin extender shared/errors/domain-error: el slice rich-text es agnóstico al
 * mapeo HTTP del producto — los slices consumidores (discussions, library,
 * events) traducen estos errores a `ValidationError`/etc. al envolverlos.
 */

/** El AST serializado excede el cap de bytes permitido. */
export class RichTextTooLargeError extends Error {
  public readonly bytes: number
  public readonly max: number

  constructor(bytes: number, max: number) {
    super(`Rich text excede el cap de ${max} bytes (actual: ${bytes}).`)
    this.name = 'RichTextTooLargeError'
    this.bytes = bytes
    this.max = max
  }
}

/** Las listas anidadas exceden la profundidad máxima permitida. */
export class RichTextTooDeepError extends Error {
  public readonly depth: number
  public readonly max: number

  constructor(depth: number, max: number) {
    super(`Rich text excede la profundidad máxima de listas (${max}) — actual: ${depth}.`)
    this.name = 'RichTextTooDeepError'
    this.depth = depth
    this.max = max
  }
}
