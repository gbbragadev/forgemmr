import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {resolveForgeRoot} from '../src/root.ts';

test('resolve a raiz do Forge mesmo quando npm executa a TUI dentro do workspace', () => {
	const repositoryRoot = path.resolve('C:/Dev/forge-fixture');
	const moduleUrl = pathToFileURL(path.join(repositoryRoot, 'maestro', 'tui', 'src', 'root.ts')).href;
	assert.equal(resolveForgeRoot({envRoot: '', moduleUrl}), repositoryRoot);
});

test('FORGE_ROOT continua sendo um override explícito', () => {
	assert.equal(resolveForgeRoot({envRoot: './forge-alternativo'}), path.resolve('./forge-alternativo'));
});
