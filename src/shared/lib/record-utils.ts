/**
 * Returns a shallow copy of `record` with `key` removed. Exists specifically
 * to avoid `delete obj[dynamicKey]` (flagged by
 * `@typescript-eslint/no-dynamic-delete` - deleting a computed property key
 * can deoptimize V8's hidden-class machinery) in the many Zustand-store
 * "unset one entry" reducers this app has (hideout built-levels, kappa got
 * items, etc.).
 *
 * The two `as` casts are an unavoidable consequence of `Object.keys` always
 * widening to `string[]` and of building the result via an empty object
 * literal - both are standard, narrowly-scoped patterns for a generic
 * omit-by-key helper, not an escape hatch around real type safety.
 */
export function omitKey<TKey extends string, TValue>(
  record: Readonly<Record<TKey, TValue>>,
  key: TKey,
): Record<TKey, TValue> {
  const result = {} as Record<TKey, TValue>;
  for (const entryKey of Object.keys(record) as TKey[]) {
    if (entryKey === key) continue;
    result[entryKey] = record[entryKey];
  }
  return result;
}
