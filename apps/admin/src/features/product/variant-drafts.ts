import { variantCombinationKey } from '@shop-38/contracts'

export type OptionDraft = {
  /** Stable React key; an option's name is edited in place. */
  key: string
  name: string
  values: string[]
}

export type VariantDraft = {
  /** The combination: `variantCombinationKey(optionValues)`. */
  key: string
  /** A saved variant. New ones have none until the product is saved. */
  id?: string
  optionValues: string[]
  sku: string
  price: number | null
  /**
   * The struck-through "was" price. The admin no longer edits it, but a variant
   * saved with one keeps it — until a new price makes it meaningless.
   */
  compareAtPrice: number | null
}

/** Options that can produce variants: named, and with at least one value. */
export const usableOptions = (options: OptionDraft[]) =>
  options.filter((option) => option.name.trim() && option.values.length > 0)

/** Every combination of the options' values, in the options' order. One empty combination for none. */
function combinations(options: OptionDraft[]): string[][] {
  return options.reduce<string[][]>(
    (acc, option) => acc.flatMap((combo) => option.values.map((value) => [...combo, value])),
    [[]],
  )
}

const newDraft = (optionValues: string[]): VariantDraft => ({
  key: variantCombinationKey(optionValues),
  optionValues,
  sku: '',
  price: null,
  compareAtPrice: null,
})

/**
 * The variants for `options`, reusing `previous` drafts wherever they fit, so a
 * saved variant keeps its id — and with it its price history — when
 * options change around it:
 *
 * 1. A draft whose exact combination still exists keeps it. This also covers a
 *    renamed option, since only values make up a combination.
 * 2. Otherwise a draft is carried over to a combination it is compatible with:
 *    adding a first option turns the single default variant into the first
 *    combination, and removing an option collapses variants onto the first
 *    one that had each remaining combination — as Shopify does.
 *
 * Combinations in `removed` were deleted by hand and are left out.
 */
export function regenerateVariants(
  previous: VariantDraft[],
  previousOptions: OptionDraft[],
  options: OptionDraft[],
  removed: ReadonlySet<string>,
): VariantDraft[] {
  const usable = usableOptions(options)
  const combos = combinations(usable).filter((combo) => !removed.has(variantCombinationKey(combo)))
  const previousUsable = usableOptions(previousOptions)

  const claimed = new Set<VariantDraft>()
  const byKey = new Map(previous.map((draft) => [draft.key, draft]))
  const result: (VariantDraft | undefined)[] = combos.map((combo) => {
    const draft = byKey.get(variantCombinationKey(combo))
    if (draft) claimed.add(draft)
    return draft
  })

  // Values by option name, for matching across an added or removed option.
  const valuesByName = (draft: VariantDraft) =>
    new Map(previousUsable.map((option, i) => [option.key, draft.optionValues[i]]))
  const unclaimed = previous.filter((draft) => !claimed.has(draft))

  return combos.map((combo, i) => {
    const exact = result[i]
    if (exact) return exact
    const compatible = unclaimed.find((draft) => {
      if (claimed.has(draft)) return false
      const theirs = valuesByName(draft)
      return usable.every((option, j) => !theirs.has(option.key) || theirs.get(option.key) === combo[j])
    })
    if (!compatible) return newDraft(combo)
    claimed.add(compatible)
    return { ...compatible, key: variantCombinationKey(combo), optionValues: combo }
  })
}

/** "24см / Хар", or "Үндсэн" for the single variant of a product without options. */
export const variantLabel = (optionValues: readonly string[]) =>
  optionValues.length > 0 ? optionValues.join(' / ') : 'Үндсэн'
