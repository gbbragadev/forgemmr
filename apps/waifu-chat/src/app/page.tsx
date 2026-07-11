import { WaifuChatApp } from "../components/WaifuChatApp";
import { appConfig } from "../../app.config";

export default function HomePage() {
  return (
    <main className="af-shell">
      <header className="af-hero">
        <h1>{appConfig.name}</h1>
        <p>
          Escolha um personagem estilo anime e converse em português. Mesma base da
          factory: tema + IA + UI — troque o manifesto e nasce o próximo app.
        </p>
      </header>
      <WaifuChatApp
        personas={appConfig.personas}
        freePerDay={appConfig.monetization.freePerDay}
        disclaimer={appConfig.legal.disclaimer}
        appName={appConfig.name}
        shareHooks={appConfig.share.tiktokHookTemplates}
      />
    </main>
  );
}
