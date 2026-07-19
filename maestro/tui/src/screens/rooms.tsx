import React from 'react';
import {Box, Text} from 'ink';

export function RoomsScreen({rooms, theses, selectedRoomId, selectedThesisId}: {rooms: Array<{id: string; title: string}>; theses: Array<{id: string; roomId: string; stage: string}>; selectedRoomId: string | null; selectedThesisId: string | null}) {
	return <Box width={24} flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
		<Text bold color="cyan">ROOMS / THESES</Text>
		{rooms.map(room => <Text key={room.id} inverse={room.id === selectedRoomId}>{room.id === selectedRoomId ? '› ' : '  '}{room.title}</Text>)}
		<Text dimColor>────────────</Text>
		{theses.filter(thesis=>thesis.roomId===selectedRoomId).map(thesis => <Text key={thesis.id} inverse={thesis.id===selectedThesisId}>{thesis.id===selectedThesisId?'›':'·'} {thesis.stage} · {thesis.id.slice(0, 8)}</Text>)}
	</Box>;
}
