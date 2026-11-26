import spec from '../../../../../static/ai-openapi.json';
import { aiJson } from '$lib/server/ai-http';
export const GET = () => aiJson(spec);
