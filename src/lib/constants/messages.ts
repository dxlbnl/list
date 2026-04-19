export const MESSAGES = {
	AUTH: {
		MAGIC_LINK_SENT_TITLE: "Access_Link_Dispatched",
		MAGIC_LINK_SENT_MESSAGE: "Secure access link transmitted to inbox. Verify identity to continue.",
		MAGIC_LINK_HINT: "Hint: Verify_Spam_Directory if transmission_latency > 30s",
		INVALID_TOKEN: "Auth_Error: Token_Invalid_Or_Expired",
		EXPIRED_TOKEN: "Auth_Error: Link_Lifetime_Exceeded",
		CONTEXT_MISSING: "Auth_Error: Context_Missing",
		UNAUTHORIZED: "Access_Denied: Authentication_Required",
		NOT_AUTHENTICATED: "Access_Denied: Session_Required",
		FORBIDDEN: "Access_Denied: Insufficient_Permissions",
		RATE_LIMIT: "Protocol_Violation: Rate_Limit_Exceeded. Retry_In: 600s",
		EMAIL_REQUIRED: "Input_Error: Identity_String_Required",
	},
	DATA: {
		NOT_FOUND: "Data_Error: Resource_Not_Found",
		INVITE_EXPIRED: "Invite_Error: Link_Expired",
		SYNC_FAILED: "Sync_Error: Connection_Lost",
		PROCESS_ERROR: "Process_Error: Operation_Failed",
		KEY_GEN_FAILED: "Process_Error: Key_Generation_Failed",
	}
} as const;
