/**
 * Shared vocabularies. packages/db builds its pgEnums from these arrays,
 * so the database and the type system cannot drift apart.
 */
export const CATEGORIES = ['electric_pot', 'pot', 'steamer', 'iron'] as const;
export type Categories = (typeof CATEGORIES)[number];
