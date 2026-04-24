// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				id: string;
				email: string | null;
				email_verified: boolean;
				createdAt: Date;
			} | null;
			session: {
				id: string;
				userId: string;
			} | null;
			supabaseToken?: string;
			sessionInvalid?: boolean;
		}
		interface PageData {
			user: Locals['user'];
			supabaseToken?: string;
			sessionInvalid?: boolean;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export { };
