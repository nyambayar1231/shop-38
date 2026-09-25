import { slugify, slugWithSuffix } from '@shop-38/contracts';

/**
 * Two rows can easily transliterate alike, so a derived slug retries with a
 * numeric suffix rather than failing — the same thing Shopify, WooCommerce and
 * Magento do. The cap is a safety net; needing this many means something is wrong.
 */
const MAX_SLUG_ATTEMPTS = 10;

/**
 * Inserts with a slug derived from `name`, then `-2`, `-3`… while the slug is taken.
 * `fallback` covers names that transliterate to nothing (punctuation, emoji, CJK).
 * Any error other than a slug conflict — a duplicate name, say — is rethrown at once.
 */
export async function insertWithDerivedSlug<T>(
  name: string,
  fallback: string,
  insert: (slug: string) => Promise<T>,
  isSlugConflict: (error: unknown) => boolean,
): Promise<T> {
  const base = slugify(name) || fallback;
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    try {
      return await insert(slugWithSuffix(base, attempt));
    } catch (error) {
      if (!isSlugConflict(error)) throw error;
    }
  }
  throw new Error(`could not derive a free slug from "${base}"`);
}
