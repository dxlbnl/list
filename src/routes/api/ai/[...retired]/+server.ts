import { retiredAiResponse } from '$lib/server/ai-http';
import type { RequestHandler } from './$types';

export const fallback: RequestHandler = retiredAiResponse;
