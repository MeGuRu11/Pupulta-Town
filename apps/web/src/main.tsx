import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const TowerStudy = lazy(() => import("./scene/TowerPrototype.tsx"));
const showTower = /^\/prototype\/tower\/?$/.test(window.location.pathname);

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing in index.html");

createRoot(root).render(
  <StrictMode>
    {showTower ? <Suspense fallback={<p role="status">Загружаем башню…</p>}><TowerStudy /></Suspense> : <App />}
  </StrictMode>,
);
