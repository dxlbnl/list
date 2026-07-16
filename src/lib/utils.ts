export function slugify(text: string): string {
	return text
		.toString()
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^\w-]+/g, '') // Remove all non-word chars
		.replace(/--+/g, '-') // Replace multiple - with single -
		.replace(/^-+/, '') // Trim - from start of text
		.replace(/-+$/, ''); // Trim - from end of text
}

export const RESERVED_SLUGS = ['login', 'settings', 'api', 'confirm', 'list', 'favicon', 'robots', 'static', 'app'];

export function isReservedSlug(slug: string): boolean {
	return RESERVED_SLUGS.includes(slug.toLowerCase());
}

export { nanoid } from 'nanoid';

/**
 * Fractional-index rank between two neighbours, for O(1) reorder without renumbering the list.
 * `null` means "no neighbour on that side" (a list end). Repeated midpoints stay strictly ordered
 * until float precision runs out (renormalise then — a rare, separate pass).
 */
export function rankBetween(before: number | null, after: number | null): number {
	if (before == null && after == null) return 0;
	if (before == null) return after! - 1;
	if (after == null) return before + 1;
	return (before + after) / 2;
}
