/** Keep the supplied order while placing the displayed placeholder last. */
export function placeholderOptionsLast<T>(options: readonly T[], label: (option: T) => string): T[] {
  return [...options].sort((a, b) => Number(label(a).trim() === '--') - Number(label(b).trim() === '--'));
}
