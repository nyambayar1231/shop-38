import { z } from 'zod';

/** Longest a slug may be. `slugify` truncates to it. */
export const MAX_SLUG_LENGTH = 120;

/** Lowercase, digits, single hyphens between words. Slugs are URLs. */
export const slugSchema = z
  .string()
  .min(1)
  .max(MAX_SLUG_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case');

/**
 * Mongolian Cyrillic -> Latin, so a category named "Гар утас" can still suggest a
 * URL-safe slug. Follows the common MNS 5217 style romanisation (х -> kh, ц -> ts,
 * ч -> ch, ш -> sh); it is a suggestion the user can always overwrite, not a
 * reversible transliteration.
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'ye',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  ө: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ү: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: 'i',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

/**
 * Produces a lowercase kebab-case slug satisfying `slugSchema` — except that an
 * input with nothing transliterable (punctuation, emoji, CJK) yields `''`, which
 * `slugSchema` rejects. Callers deriving a slug must supply their own fallback.
 */
export function slugify(input: string): string {
  return Array.from(input.toLowerCase())
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}

/**
 * `base` with `-2`, `-3`… appended for de-duplication, trimmed so the result
 * still satisfies `slugSchema` even when `base` is already at full length.
 */
export function slugWithSuffix(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  return base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/-+$/, '') + suffix;
}
