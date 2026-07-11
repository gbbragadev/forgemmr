import { AnimeQuizApp } from "../components/AnimeQuizApp";
import { appConfig } from "../../app.config";
import quizJson from "../../../../content/quizzes/anime-archetype-v1.json";
import type { QuizBank } from "../lib/quiz";

const quiz = quizJson as unknown as QuizBank;

// header/subtítulo vivem no componente client (i18n PT/EN com toggle persistido)
export default function HomePage() {
  return (
    <main className="af-shell">
      <AnimeQuizApp
        quiz={quiz}
        archetypes={appConfig.personas}
        appName={appConfig.name}
        disclaimer={appConfig.legal.disclaimer}
        shareHooks={appConfig.share.tiktokHookTemplates}
      />
    </main>
  );
}
