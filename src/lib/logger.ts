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
	private transport: ((payload: Record<string, unknown>) => void) | null = null;
	private flushFn: (() => Promise<void>) | null = null;

	constructor(private context: Record<string, unknown> = {}) { }

	/**
	 * Internal method to register a server-side transport (e.g. Axiom).
	 * This should only be called from server-only code (like hooks.server.ts).
	 */
	_setTransport(transport: (payload: Record<string, unknown>) => void, flush?: () => Promise<void>) {
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

	private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
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
			const logPayload: Record<string, unknown> = {
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
				const colors = {
					reset: "\x1b[0m",
					bright: "\x1b[1m",
					dim: "\x1b[2m",
					cyan: "\x1b[36m",
					yellow: "\x1b[33m",
					red: "\x1b[31m",
					green: "\x1b[32m",
					magenta: "\x1b[35m"
				};

				const colorMap: Record<LogLevel, string> = {
					debug: colors.dim,
					info: colors.cyan,
					warn: colors.yellow,
					error: colors.red
				};

				const statusColor = (s?: number) => {
					if (!s) return colors.reset;
					if (s >= 500) return colors.red;
					if (s >= 400) return colors.yellow;
					if (s >= 200) return colors.green;
					return colors.reset;
				};

				const prefix = `${colorMap[level]}[${level.toUpperCase()}]${colors.reset}`;

				const method = typeof ctx.method === 'string' ? ctx.method : undefined;
				const path = typeof ctx.path === 'string' ? ctx.path : undefined;

				// Special formatting for request logs
				if (method && path) {
					const statusNum = typeof ctx.status === 'number' ? ctx.status : undefined;
					const status = statusNum ? `${statusColor(statusNum)}${statusNum}${colors.reset}` : '';
					const duration = ctx.duration != null ? `${colors.dim}${ctx.duration}ms${colors.reset}` : '';
					const userId = typeof ctx.userId === 'string' ? ctx.userId : undefined;
					const user = userId ? `${colors.magenta}@${userId.slice(0, 5)}${colors.reset}` : '';

					const { method: _m, path: _p, status: _s, duration: _d, userId: _u, ...remaining } = ctx;
					const remainingStr = Object.keys(remaining).length > 0 ? ` ${colors.dim}${JSON.stringify(remaining)}${colors.reset}` : '';

					console.log(`${prefix} ${colors.bright}${method}${colors.reset} ${path} ${status} ${duration} ${user}${remainingStr}`);
				} else {
					const ctxStr = hasCtx ? ` ${colors.dim}${JSON.stringify(ctx)}${colors.reset}` : '';
					console.log(`${prefix} ${message}${ctxStr}`);
				}
			}
		}
	}

	debug(message: string, data?: Record<string, unknown>) {
		this.log('debug', message, data);
	}

	info(message: string, data?: Record<string, unknown>) {
		this.log('info', message, data);
	}

	warn(message: string, data?: Record<string, unknown>) {
		this.log('warn', message, data);
	}

	error(message: string, data?: Record<string, unknown>, error?: unknown) {
		const errorData: Record<string, unknown> = {};
		if (error instanceof Error) {
			errorData.errorMessage = error.message;
			errorData.stack = dev ? error.stack : undefined;
		} else if (error) {
			errorData.error = String(error);
		}
		this.log('error', message, { ...data, ...errorData });
	}

	child(context: Record<string, unknown>) {
		const child = new Logger({ ...this.context, ...context });
		child.transport = this.transport;
		child.flushFn = this.flushFn;
		return child;
	}
}

export const logger = new Logger();
