import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createMaestroClient} from '../src/client.ts';

function rootWithToken(token = 'private-token-123') {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-tui-client-'));
	fs.mkdirSync(path.join(root, 'maestro'), {recursive: true});
	fs.writeFileSync(path.join(root, 'maestro', '.token'), token);
	return root;
}

function response(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
}

test('client mantém token privado e autentica snapshot, room, thesis, execute e confirmation', async () => {
	const root = rootWithToken();
	const calls: Array<{url: string; init: RequestInit}> = [];
	const fetchImpl = (async (url: string | URL | Request, init: RequestInit = {}) => {
		calls.push({url: String(url), init});
		if (String(url).endsWith('/snapshot')) return response({version: 'v1', discovery: {revision: 1, rooms: [], theses: []}, actions: [], runner: {activeRunId: null}});
		if (String(url).includes('/rooms/')) return response({id: 'room-1'});
		if (String(url).includes('/theses/')) return response({id: 'thesis-1'});
		if (String(url).endsWith('/confirmations')) return response({nonce: 'nonce-1'}, 201);
		return response({status: 'succeeded'});
	}) as typeof fetch;
	const client = createMaestroClient({root, fetchImpl});
	assert.equal('token' in client, false);
	await client.snapshot();
	await client.room('room/1');
	await client.thesis('thesis/1');
	await client.execute({actionId: 'room.create', input: {title: 'Café'}, stateVersion: 'v1', idempotencyKey: 'idem-123456'});
	await client.confirm({actionId: 'thesis.confirm', stateVersion: 'v1'});
	assert.deepEqual(calls.map(call => new URL(call.url).pathname), [
		'/api/control/snapshot', '/api/discovery/rooms/room%2F1', '/api/discovery/theses/thesis%2F1',
		'/api/control/actions/execute', '/api/control/confirmations',
	]);
	for (const call of calls) assert.equal(new Headers(call.init.headers).get('X-Maestro-Token'), 'private-token-123');
	assert.doesNotMatch(JSON.stringify(client), /private-token-123/);
	assert.match(String(calls[3].init.body), /room\.create/);
});

test('SSE reconecta com Last-Event-ID, retry limitado e entrega eventos incrementais', async () => {
	const root = rootWithToken();
	const calls: Array<{url: string; headers: Headers}> = [];
	let attempt = 0;
	const encoder = new TextEncoder();
	const fetchImpl = (async (url: string | URL | Request, init: RequestInit = {}) => {
		calls.push({url: String(url), headers: new Headers(init.headers)});
		attempt++;
		if (attempt === 1) throw new Error('rede caiu');
		const stream = new ReadableStream({start(controller) {
			controller.enqueue(encoder.encode('id: 7\ndata: {"type":"chat.chunk","text":"ação"}\n\n'));
			controller.close();
		}});
		return new Response(stream, {status: 200});
	}) as typeof fetch;
	const sleeps: number[] = [];
	const client = createMaestroClient({root, fetchImpl, sleep: async ms => { sleeps.push(ms); }});
	const events: any[] = [];
	const controller = new AbortController();
	await client.events(event => { events.push(event); controller.abort(); }, controller.signal, {lastEventId: 4, maxRetries: 2});
	assert.equal(calls.length, 2);
	assert.equal(calls[0].headers.get('Last-Event-ID'), '4');
	assert.match(calls[1].url, /after=4/);
	assert.deepEqual(sleeps, [250]);
	assert.equal(events[0].text, 'ação');
});

test('erros HTTP/stale rejeitam e opener externo exige ação explícita', async () => {
	const root = rootWithToken();
	const client = createMaestroClient({root, fetchImpl: (async () => response({error: 'estado stale', code: 'state_stale'}, 409)) as typeof fetch});
	await assert.rejects(() => client.snapshot(), error => (error as any).status === 409 && (error as any).code === 'state_stale');
	const opened: string[] = [];
	client.openExternal('https://example.com/a.png', target => opened.push(target));
	assert.deepEqual(opened, ['https://example.com/a.png']);
	assert.throws(() => client.openExternal('javascript:alert(1)', target => opened.push(target)), /inválido/);
});
