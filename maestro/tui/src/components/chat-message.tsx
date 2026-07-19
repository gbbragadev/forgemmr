import React from 'react';
import {Text} from 'ink';

/** Adapted from termcn registry/bases/ink/ui/chat-message.tsx (MIT). */
export function ChatMessage({children}: {children: React.ReactNode}) {
	return <Text>{children}</Text>;
}
