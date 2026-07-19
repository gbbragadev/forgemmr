import React from 'react';
import {Box, Text} from 'ink';

/** Adapted from termcn registry/bases/ink/ui/sidebar.tsx (MIT). */
export function Sidebar({source, focused}: {source: string; focused: boolean}) {
	return <Box width={18} flexDirection="column"><Text inverse={focused}> Fontes </Text><Text>Fonte: {source}</Text><Text> · comunidade</Text></Box>;
}
