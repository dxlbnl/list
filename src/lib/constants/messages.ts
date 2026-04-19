export const MESSAGES = {
	AUTH: {
		MAGIC_LINK_SENT_TITLE: "Link sent",
		MAGIC_LINK_SENT_MESSAGE: "We've sent a secure login link to your email inbox.",
		MAGIC_LINK_HINT: "Check your spam folder if it doesn't arrive soon.",
		INVALID_TOKEN: "Invalid or expired link",
		EXPIRED_TOKEN: "Link has expired",
		CONTEXT_MISSING: "Authentication failed",
		UNAUTHORIZED: "Authentication required",
		NOT_AUTHENTICATED: "Please sign in to continue",
		FORBIDDEN: "You don't have access to this",
		RATE_LIMIT: "Too many requests. Please try again in 10 minutes.",
		EMAIL_REQUIRED: "Email is required",
	},
	DATA: {
		NOT_FOUND: "Resource not found",
		INVITE_EXPIRED: "Invite link has expired",
		SYNC_FAILED: "Sync failed",
		PROCESS_ERROR: "An error occurred",
		KEY_GEN_FAILED: "Failed to generate key",
	}
} as const;
