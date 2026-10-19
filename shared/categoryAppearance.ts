export const CATEGORY_ICONS=['book','briefcase','robot','cpu','airplane','food','game','video','home','fitness'] as const;
export const CATEGORY_TONES=['lime','lavender','peach','blue','rose'] as const;
export type CategoryIcon=typeof CATEGORY_ICONS[number];
export type CategoryTone=typeof CATEGORY_TONES[number];
