import React, {useState} from 'react';
import {Box, Text, render, useApp, useInput} from 'ink';
import {ChatMessage} from './components/chat-message.js';
import {CommandPalette} from './components/command-palette.js';
import {Sidebar} from './components/sidebar.js';
import {StreamingText} from './components/streaming-text.js';
import {Tabs} from './components/tabs.js';
import {ToolApproval} from './components/tool-approval.js';

export type DiscoverySpikeProps = {initialStream: string};

const focusOrder = ['sidebar', 'tabs', 'input', 'approval'] as const;
type Focus = (typeof focusOrder)[number];

export function DiscoverySpike({initialStream}: DiscoverySpikeProps) {
	const {exit} = useApp();
	const [query, setQuery] = useState('');
	const [focus, setFocus] = useState<Focus>('sidebar');
	const [tab, setTab] = useState('Descoberta');
	const [source, setSource] = useState('diretórios');
	const [approved, setApproved] = useState(false);
	const [palette, setPalette] = useState(false);

	useInput((input, key) => {
		if (key.ctrl && input === 'c') return exit();
		if (key.tab) return setFocus(current => focusOrder[(focusOrder.indexOf(current) + 1) % focusOrder.length]);
		if (focus !== 'input' && input === ':') return setPalette(current => !current);
		if (focus === 'sidebar' && input === 'd') return setSource('diretórios');
		if (focus === 'sidebar' && input === 'c') return setSource('comunidade');
		if (focus === 'tabs' && (key.leftArrow || key.rightArrow || key.return)) return setTab(current => current === 'Descoberta' ? 'Evidências' : 'Descoberta');
		if (focus === 'approval' && key.return) return setApproved(true);
		if (focus === 'input' && (key.backspace || key.delete)) return setQuery(current => current.slice(0, -1));
		if (focus === 'input' && !key.ctrl && !key.meta && input) setQuery(current => current + input);
	});

	return <Box flexDirection="column" paddingX={1}>
		<Text bold color="cyan">Forge Discovery-First · spike Ink</Text>
		<Box marginTop={1}>
			<Sidebar source={source} focused={focus === 'sidebar'} />
			<Box flexDirection="column" flexGrow={1}>
				<Tabs active={tab} focused={focus === 'tabs'} />
				<StreamingText>{initialStream}</StreamingText>
				<ToolApproval approved={approved} focused={focus === 'approval'} />
				<ChatMessage><Text inverse={focus === 'input'}>Busca: {query || '…'}</Text></ChatMessage>
			</Box>
		</Box>
		<Text dimColor>Foco: {focus} · Tab alterna · : palette · Ctrl+C sai</Text>
		<CommandPalette open={palette} />
	</Box>;
}

if (process.argv[1]?.endsWith('spike.js') || process.argv[1]?.endsWith('spike.tsx')) render(<DiscoverySpike initialStream="Aguardando fontes…" />);
