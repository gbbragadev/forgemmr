import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function resolveForgeRoot({
	envRoot = process.env.FORGE_ROOT,
	moduleUrl = import.meta.url,
}: {envRoot?: string; moduleUrl?: string} = {}) {
	if (envRoot) return path.resolve(envRoot);
	return path.resolve(fileURLToPath(new URL('../../../', moduleUrl)));
}
