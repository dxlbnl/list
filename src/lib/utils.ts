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
