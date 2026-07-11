import type { CSSProperties } from "react";

type Props = {
  name: string;
  tags: string[];
  color?: string;
  selected?: boolean;
  onClick?: () => void;
};

export function CharacterCard({ name, tags, color = "#ff4d9a", selected, onClick }: Props) {
  const card: CSSProperties = {
    textAlign: "left",
    width: "100%",
    padding: 14,
    borderRadius: 16,
    border: selected ? `2px solid ${color}` : "1px solid var(--af-border)",
    background: selected
      ? `linear-gradient(145deg, ${color}33, var(--af-surface))`
      : "var(--af-surface)",
    color: "var(--af-ink)",
    cursor: "pointer",
    boxShadow: selected ? `0 0 24px ${color}55` : "none",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  };

  return (
    <button type="button" style={card} onClick={onClick}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          marginBottom: 10,
          background: `linear-gradient(135deg, ${color}, #7b2ff7)`,
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: 18,
        }}
      >
        {name.slice(0, 1)}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{name}</div>
      <div style={{ fontSize: 12, color: "var(--af-muted)" }}>{tags.join(" · ")}</div>
    </button>
  );
}
