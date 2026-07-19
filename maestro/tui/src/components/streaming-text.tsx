import React from 'react';
import {Text} from 'ink';

/** Adapted from termcn registry/bases/ink/ui/streaming-text.tsx (MIT). */
export function StreamingText({children}: {children: string}) {
	return <Text color="yellow">Stream: {children}</Text>;
}
