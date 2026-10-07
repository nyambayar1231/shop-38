import { z } from 'zod';
import { CATEGORY_STATUSES, PRODUCT_STATUSES } from './enums.js';
import { slugSchema } from './slug.js';

// ---------------------------------------------------------------------------
// Categories.
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  /**
   * Omit it and the API derives one from `name`, de-duplicating with a numeric
   * suffix. Pass one only to claim a specific URL — then a collision is a 409
   * rather than something silently renamed.
   */
  slug: slugSchema.optional(),
  name: z.string().min(1).max(150),
  description: z.string().max(300).nullish(),
  status: z.enum(CATEGORY_STATUSES),
  /** A file from POST /files that has completed its upload. `null` removes the image. */
  imageFileId: z.uuid().nullish(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/**
 * Every field optional, but `.strict()` so a typo'd key is a 400 rather than a
 * silently ignored no-op — the worst possible outcome for an edit form.
 */
export const updateCategorySchema = createCategorySchema.partial().strict();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryIdParamSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Products, options and variants.
//
// Shopify's model: a product ("Хайруулын таваг") has up to three options
// ("Хэмжээ": 24см, 28см; "Өнгө": Хар, Улаан), and every sellable combination of
// their values is a variant with its own SKU and price. A product with no
// options still has exactly one variant — it is what price hangs off.
// ---------------------------------------------------------------------------

/** Shopify's classic limits. Three options already allow far more variants than a shop can stock. */
export const MAX_PRODUCT_OPTIONS = 3;
export const MAX_OPTION_VALUES = 50;
export const MAX_PRODUCT_VARIANTS = 100;

/**
 * Whole tögrög. MNT has no minor unit in practice, so there is nothing to divide
 * by 100 and no rounding to get wrong. The cap is a sanity limit, not a business rule.
 */
export const moneySchema = z.int().min(0).max(1_000_000_000);

/** No control characters: `variantCombinationKey` joins labels with a newline. */
const optionLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[^\p{Cc}]+$/u, 'must not contain control characters');

export const productOptionSchema = z.object({
  /** "Хэмжээ", "Өнгө". */
  name: optionLabelSchema,
  /** In display order. Variants refer to these by label. */
  values: z.array(optionLabelSchema).min(1).max(MAX_OPTION_VALUES),
});

export type ProductOptionInput = z.infer<typeof productOptionSchema>;

export const productVariantSchema = z.object({
  /** An existing variant, when re-saving a product. Omit it for a new one. */
  id: z.uuid().optional(),
  /** One value per option, in the options' order. Empty for a product with no options. */
  optionValues: z.array(optionLabelSchema).max(MAX_PRODUCT_OPTIONS),
  /** The shop's stock-keeping code for this exact variant. Unique across the shop when present. */
  sku: z.string().trim().min(1).max(64).nullish(),
  price: moneySchema,
  /** The "was" price shown struck through. Must be higher than `price` to mean anything. */
  compareAtPrice: moneySchema.nullish(),
});

export type ProductVariantInput = z.infer<typeof productVariantSchema>;

const variantsShape = {
  options: z.array(productOptionSchema).max(MAX_PRODUCT_OPTIONS),
  variants: z.array(productVariantSchema).min(1).max(MAX_PRODUCT_VARIANTS),
};

/** Stable identity of a combination of option values. */
export const variantCombinationKey = (optionValues: readonly string[]) => optionValues.join('\n');

/**
 * The rules that span fields, so the API never has to discover them half-way
 * through a transaction. Each issue's `path` points at the offending entry, and
 * its `message` is a stable code the admin maps to its own copy.
 */
function checkOptionsAndVariants(
  { options, variants }: { options: ProductOptionInput[]; variants: ProductVariantInput[] },
  ctx: z.RefinementCtx,
) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: 'custom', path, message });

  const optionNames = new Set<string>();
  options.forEach((option, i) => {
    const name = option.name.toLocaleLowerCase();
    if (optionNames.has(name)) issue(['options', i, 'name'], 'duplicate_option');
    optionNames.add(name);

    const values = new Set<string>();
    option.values.forEach((value, j) => {
      const key = value.toLocaleLowerCase();
      if (values.has(key)) issue(['options', i, 'values', j], 'duplicate_value');
      values.add(key);
    });
  });

  if (options.length === 0 && variants.length > 1) {
    issue(['variants'], 'options_required');
  }

  const combinations = new Set<string>();
  const skus = new Set<string>();
  const ids = new Set<string>();
  variants.forEach((variant, i) => {
    if (variant.optionValues.length !== options.length) {
      issue(['variants', i, 'optionValues'], 'option_count');
    } else {
      variant.optionValues.forEach((value, j) => {
        if (!options[j]!.values.includes(value)) {
          issue(['variants', i, 'optionValues', j], 'unknown_value');
        }
      });
    }

    const combination = variantCombinationKey(variant.optionValues);
    if (combinations.has(combination)) issue(['variants', i, 'optionValues'], 'duplicate_variant');
    combinations.add(combination);

    if (variant.sku) {
      if (skus.has(variant.sku)) issue(['variants', i, 'sku'], 'duplicate_sku');
      skus.add(variant.sku);
    }

    if (variant.id) {
      if (ids.has(variant.id)) issue(['variants', i, 'id'], 'duplicate_id');
      ids.add(variant.id);
    }

    if (variant.compareAtPrice != null && variant.compareAtPrice <= variant.price) {
      issue(['variants', i, 'compareAtPrice'], 'compare_at_not_higher');
    }
  });
}

/** The product's own fields — everything but its options and variants. */
export const productDetailsSchema = z.object({
  /**
   * Omit it and the API derives one from `name`, de-duplicating with a numeric
   * suffix. Pass one only to claim a specific URL — then a collision is a 409
   * rather than something silently renamed.
   */
  slug: slugSchema.optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  /** The shop's own product code. Unique when present. Each variant has its own SKU too. */
  code: z.string().trim().min(1).max(64).nullish(),
  categoryId: z.uuid(),
  status: z.enum(PRODUCT_STATUSES).default('active'),
  /** A file from POST /files that has completed its upload. `null` removes the image. */
  imageFileId: z.uuid().nullish(),
});

export type ProductDetailsInput = z.infer<typeof productDetailsSchema>;

/** A whole product in one request, so it is created with its variants or not at all. */
export const createProductSchema = productDetailsSchema
  .extend(variantsShape)
  .superRefine(checkOptionsAndVariants);

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Every field optional, but `.strict()` so a typo'd key is a 400 rather than a
 * silently ignored no-op — the worst possible outcome for an edit form.
 * Options and variants change through their own endpoint.
 */
export const updateProductSchema = productDetailsSchema
  .extend({ status: z.enum(PRODUCT_STATUSES) })
  .partial()
  .strict();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * The complete desired set of options and variants. Existing variants are kept by
 * `id`; one left out is removed.
 */
export const updateProductVariantsSchema = z
  .object(variantsShape)
  .strict()
  .superRefine(checkOptionsAndVariants);

export type UpdateProductVariantsInput = z.infer<typeof updateProductVariantsSchema>;

export const productIdParamSchema = z.object({
  id: z.uuid(),
});

export const listProductsQuerySchema = z.object({
  categoryId: z.uuid().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

/** A new price for one variant, in effect from now. The old one stays in its history. */
export const changeVariantPriceSchema = z
  .object({
    price: moneySchema,
  })
  .strict();

export type ChangeVariantPriceInput = z.infer<typeof changeVariantPriceSchema>;
