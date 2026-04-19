import { dev, browser } from '$app/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

// Log level threshold
const LOG_LEVEL = dev ? levels.debug : levels.info;

/**
 * Isomorphic Logger optimized for SvelteKit & Vercel.
 * In production (server-side), it outputs structured JSON for Axiom.
 * In development, it uses styled console logs for readability.
 */
class Logger {
	private transport: ((payload: any) => void) | null = null;
	private flushFn: (() => Promise<void>) | null = null;

	constructor(private context: Record<string, any> = {}) { }

	/**
	 * Internal method to register a server-side transport (e.g. Axiom).
	 * This should only be called from server-only code (like hooks.server.ts).
	 */
	_setTransport(transport: (payload: any) => void, flush?: () => Promise<void>) {
		this.transport = transport;
		if (flush) this.flushFn = flush;
	}

	/**
	 * Flushes any buffered logs. Useful for serverless environments.
	 */
	async flush() {
		if (this.flushFn) {
			await this.flushFn();
		}
	}

	private log(level: LogLevel, message: string, data?: Record<string, any>) {
		if (levels[level] < LOG_LEVEL) return;

		const ctx = { ...this.context, ...data };
		const hasCtx = Object.keys(ctx).length > 0;
		const timestamp = new Date().toISOString();

		if (browser) {
			const styles = {
				debug: 'color: #9e9e9e',
				info: 'color: #00bcd4',
				warn: 'color: #ff9800',
				error: 'color: #f44336; font-weight: bold'
			};
			const prefix = `[${level.toUpperCase()}]`;

			if (hasCtx) {
				console.groupCollapsed(`%c${prefix} %c${message}`, styles[level], 'color: inherit');
				console.log('Context:', ctx);
				console.groupEnd();
			} else {
				console.log(`%c${prefix} %c${message}`, styles[level], 'color: inherit');
			}
		} else {
			// Server side (Vercel/Node)
			const logPayload = {
				_time: timestamp,
				level,
				message,
				...this.context,
				...data
			};

			// 1. Send to Axiom/Transport if configured
			if (this.transport) {
				this.transport(logPayload);
			}

			// 2. Always log to console for Vercel/Dev visibility
			if (!dev) {
				// Structured JSON for Vercel Logs (if user looks at them)
				console.log(JSON.stringify(logPayload));
			} else {
				const prefix = `[${level.toUpperCase()}]`;
				const args: any[] = [`${prefix} ${message}`];
				if (hasCtx) args.push(ctx);

				switch (level) {
					case 'debug': console.debug(...args); break;
					case 'info': console.info(...args); break;
					case 'warn': console.warn(...args); break;
					case 'error': console.error(...args); break;
				}
			}
		}
	}

	debug(message: string, data?: Record<string, any>) {
		this.log('debug', message, data);
	}

	info(message: string, data?: Record<string, any>) {
		this.log('info', message, data);
	}

	warn(message: string, data?: Record<string, any>) {
		this.log('warn', message, data);
	}

	error(message: string, data?: Record<string, any>, error?: unknown) {
		const errorData: Record<string, any> = {};
		if (error instanceof Error) {
			errorData.errorMessage = error.message;
			errorData.stack = dev ? error.stack : undefined;
		} else if (error) {
			errorData.error = error;
		}
		this.log('error', message, { ...data, ...errorData });
	}

	child(context: Record<string, any>) {
		const child = new Logger({ ...this.context, ...context });
		child.transport = this.transport;
		child.flushFn = this.flushFn;
		return child;
	}
}

export const logger = new Logger();
