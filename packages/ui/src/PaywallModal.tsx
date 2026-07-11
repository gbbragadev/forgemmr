import type { CSSProperties } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "grid",
  placeItems: "center",
  zIndex: 50,
  padding: 16,
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "linear-gradient(160deg, #241834, #120c1c)",
  border: "1px solid rgba(255,77,154,0.35)",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 0 40px var(--af-glow)",
};

const btn: CSSProperties = {
  width: "100%",
  border: 0,
  borderRadius: 12,
  padding: "12px 16px",
  marginTop: 10,
  cursor: "pointer",
  fontWeight: 700,
};

export function PaywallModal({
  open,
  onClose,
  title = "Acabaram as mensagens grátis",
  subtitle = "Continue a conversa com coins ou weekly. (Billing real na Fase 2)",
}: Props) {
  if (!open) return null;

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label={title}>
      <div style={card}>
        <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>{title}</h2>
        <p style={{ margin: "0 0 16px", color: "var(--af-muted)", lineHeight: 1.5 }}>
          {subtitle}
        </p>
        <button
          type="button"
          style={{
            ...btn,
            background: "linear-gradient(90deg, var(--af-primary), var(--af-primary-2))",
            color: "#fff",
          }}
          onClick={() => alert("Fase 2: Stripe + Mercado Pago Pix")}
        >
          Coins R$9,99
        </button>
        <button
          type="button"
          style={{
            ...btn,
            background: "var(--af-surface-2)",
            color: "var(--af-ink)",
            border: "1px solid var(--af-border)",
          }}
          onClick={() => alert("Fase 2: weekly R$9,90–14,90")}
        >
          Weekly sem limite
        </button>
        <button
          type="button"
          style={{
            ...btn,
            background: "transparent",
            color: "var(--af-muted)",
          }}
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
