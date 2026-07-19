import React from 'react';
import {Box, Text} from 'ink';

export function ChatScreen({room, stream, composer, busy, playerId}: {room: any | null; stream: string; composer: string; busy: boolean; playerId: string}) {
	return <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="cyan" paddingX={1}>
		<Text bold>CHAT {room ? `· ${room.title}` : '· primeira mensagem cria uma room'}</Text>
		{(room?.messages || []).slice(-8).map((message: any) => <Text key={message.id} color={message.author === 'human' ? 'white' : 'green'}>{message.author === 'human' ? 'YOU' : message.executor?.playerId || message.author}: {message.text}</Text>)}
		{stream ? <Text color="green">STREAM: {stream}</Text> : null}
		<Text color="cyan">› {composer || <Text dimColor>Digite sua ideia ou mensagem e pressione Enter</Text>}</Text>
		<Text dimColor>{busy ? 'Enviando…' : `Enter envia · executor: ${playerId}`}</Text>
	</Box>;
}
