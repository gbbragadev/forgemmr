import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {render} from 'ink-testing-library';
import {DiscoverySpike} from '../src/spike.tsx';

const flush = () => new Promise(resolve => setTimeout(resolve, 30));

test('renders Unicode, protects input focus, streams, tabs, palette, and approval', async () => {
	const view = render(<DiscoverySpike initialStream="Descobrindo cafés em São Paulo…" />);
	assert.match(view.lastFrame() ?? '', /São Paulo/);
	assert.match(view.lastFrame() ?? '', /Foco: sidebar/);

	view.stdin.write('d');
	await flush();
	assert.match(view.lastFrame() ?? '', /Fonte: diretórios/);
	assert.doesNotMatch(view.lastFrame() ?? '', /Busca: d/);

	view.stdin.write('\t');
	await flush();
	assert.match(view.lastFrame() ?? '', /Foco: tabs/);
	view.stdin.write('[C');
	await flush();
	assert.match(view.lastFrame() ?? '', /Evidências/);

	view.stdin.write('\t');
	await flush();
	assert.match(view.lastFrame() ?? '', /Foco: input/);
	for (const character of 'ação') {
		view.stdin.write(character);
		await flush();
	}
	assert.match(view.lastFrame() ?? '', /Busca: ação/);
	view.stdin.write(':');
	await flush();
	assert.match(view.lastFrame() ?? '', /Busca: ação:/);
	assert.doesNotMatch(view.lastFrame() ?? '', /Command palette:/);

	view.rerender(<DiscoverySpike initialStream={'Descobrindo cafés em São Paulo…\nNova fonte encontrada.'} />);
	await flush();
	assert.match(view.lastFrame() ?? '', /Busca: ação/);
	assert.match(view.lastFrame() ?? '', /Nova fonte encontrada/);

	view.stdin.write('\t');
	await flush();
	assert.match(view.lastFrame() ?? '', /Foco: approval/);
	view.stdin.write('\r');
	await flush();
	assert.match(view.lastFrame() ?? '', /Approval: aprovado/);

	view.stdin.write(':');
	await flush();
	assert.match(view.lastFrame() ?? '', /Command palette:/);

	view.unmount();
});
