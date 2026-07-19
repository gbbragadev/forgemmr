import fs from 'node:fs';
import path from 'node:path';

export type CatalogField = {
	name: string;
	label: string;
	type: string;
	required: boolean;
	options: string[];
	help?: string;
	defaultValue?: string;
};
export type CatalogAction = {id: string; scope: string; label: string; risk: string; enabled: boolean; blockedReason: string | null; fields: CatalogField[]};
export type Snapshot = {
	version: string;
	discovery: {revision: number | null; rooms: Array<{id: string; title: string; messageCount: number}>; theses: Array<{id: string; roomId: string; stage: string}>};
	actions: CatalogAction[];
	runner: {activeRunId: string | null};
	server?: {status: string; cooldowns?: Record<string,number>};
	providers?: Array<{id: string; installed: boolean; status?: string; models?: Array<{id:string;label:string}>}>;
	pipelines?: Array<{appId: string; status: string; currentJob?: string; gates?: Array<{id:string;decision?:string|null;prompt?:string}>}>;
	lifecycle?: Array<{appId:string;status:string;p5?:{decision?:string}|null}>;
	alwaysOnDeployments?: Array<{appId:string;status:'prepared'|'confirmed'|'published'|'verified';updatedAt?:string;verification?:{pending?:string[]}|null}>;
};
export type DiscoveryEvent = {type: string; sequence?: number; roomId?: string; thesisId?: string; runId?: string; text?: string; status?: string};

type FetchLike = typeof fetch;
type Sleep = (ms: number) => Promise<void>;

export function createMaestroClient({
	root,
	baseUrl = 'http://127.0.0.1:8799',
	fetchImpl = fetch,
	sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}: {root: string; baseUrl?: string; fetchImpl?: FetchLike; sleep?: Sleep}) {
	const token = fs.readFileSync(path.join(root, 'maestro', '.token'), 'utf8').trim();
	const auth = {'X-Maestro-Token': token};

	async function json<T>(url: string, init: RequestInit = {}): Promise<T> {
		const response = await fetchImpl(`${baseUrl}${url}`, { ...init, headers: {...auth, ...(init.headers || {})} });
		const body = await response.json() as T & {error?: string; code?: string};
		if (!response.ok) throw Object.assign(new Error(body.error || `HTTP ${response.status}`), {status: response.status, code: body.code});
		return body;
	}

	return {
		snapshot: () => json<Snapshot>('/api/control/snapshot'),
		room: (id: string) => json<any>(`/api/discovery/rooms/${encodeURIComponent(id)}`),
		thesis: (id: string) => json<any>(`/api/discovery/theses/${encodeURIComponent(id)}`),
		execute: (request: {actionId: string; appId?: string | null; input: Record<string, unknown>; stateVersion: string; idempotencyKey: string; confirmation?: string}) =>
			json<any>('/api/control/actions/execute', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(request)}),
		confirm: (request: {actionId: string; appId?: string | null; stateVersion: string}) =>
			json<{nonce: string}>('/api/control/confirmations', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(request)}),
		openExternal(target: string, opener: (target: string) => void) {
			if (!/^(https?:\/\/|file:\/\/)/i.test(target)) throw new Error('Destino externo inválido.');
			opener(target);
		},
		async events(onEvent: (event: DiscoveryEvent) => void, signal: AbortSignal, {lastEventId = 0, maxRetries = 5} = {}) {
			let cursor = lastEventId;
			for (let attempt = 0; !signal.aborted && attempt <= maxRetries; attempt++) {
				try {
					const response = await fetchImpl(`${baseUrl}/api/events?after=${cursor}`, {headers: {...auth, ...(cursor ? {'Last-Event-ID': String(cursor)} : {})}, signal});
					if (!response.ok || !response.body) throw new Error(`SSE HTTP ${response.status}`);
					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					let buffer = '';
					while (!signal.aborted) {
						const {done, value} = await reader.read();
						if (done) break;
						buffer += decoder.decode(value, {stream: true});
						const blocks = buffer.split('\n\n');
						buffer = blocks.pop() || '';
						for (const block of blocks) {
							const id = block.match(/^id:\s*(\d+)$/m)?.[1];
							const data = block.match(/^data:\s*(.+)$/m)?.[1];
							if (!data) continue;
							if (id) cursor = Number(id);
							onEvent(JSON.parse(data));
						}
					}
					attempt = -1;
				} catch (error) {
					if (signal.aborted) break;
					if (attempt === maxRetries) throw error;
					await sleep(Math.min(250 * 2 ** attempt, 4000));
				}
			}
			return cursor;
		},
	};
}

export type MaestroClient = ReturnType<typeof createMaestroClient>;
