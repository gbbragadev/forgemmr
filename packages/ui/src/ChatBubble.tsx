import type { CSSProperties, ReactNode } from "react";

type Props = {
  role: "user" | "assistant";
  children: ReactNode;
  accent?: string;
};

export function ChatBubble({ role, children, accent = "#ff4d9a" }: Props) {
  const isUser = role === "user";
  const wrap: CSSProperties = {
    display: "flex",
    justifyContent: isUser ? "flex-end" : "flex-start",
    marginBottom: 10,
  };
  const bubble: CSSProperties = {
    maxWidth: "85%",
    padding: "10px 14px",
    borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
    background: isUser
      ? `linear-gradient(135deg, ${accent}, #9b4dff)`
      : "var(--af-surface-2)",
    border: isUser ? "none" : "1px solid var(--af-border)",
    color: "var(--af-ink)",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  return (
    <div style={wrap}>
      <div style={bubble}>{children}</div>
    </div>
  );
}
