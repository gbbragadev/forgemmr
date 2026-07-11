import type { CSSProperties } from "react";

type Props = {
  remaining: number;
  freePerDay: number;
  label?: string;
};

const style: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  borderRadius: 999,
  background: "rgba(255,77,154,0.12)",
  border: "1px solid rgba(255,77,154,0.35)",
  color: "var(--af-sakura)",
  fontSize: 13,
  fontWeight: 600,
};

export function CreditBadge({ remaining, freePerDay, label = "grátis hoje" }: Props) {
  const text =
    remaining >= 999 ? "Ilimitado" : `${remaining}/${freePerDay} ${label}`;
  return <span style={style}>✦ {text}</span>;
}
