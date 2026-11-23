import { Component, lazy, Suspense, useMemo, type ReactNode } from "react";
import { decayNames, stageNames } from "../components/TaskList.tsx";
import type { CityData } from "../tracker/types.ts";
import { makeSceneLots, sceneBlocks, sceneDecayTime } from "./model.ts";

// Load the renderer only after the user opens a city.
const Viewport = lazy(() => import("./Viewport.tsx"));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  override render() {
    if (!this.state.failed) return this.props.children;
    return <div className="scene-notice" role="status">
      <p>Не удалось открыть 3D-карту. Постройки и их этапы доступны в списке под картой.</p>
      <button className="button button-quiet" onClick={() => this.setState({ failed: false })}>Повторить</button>
    </div>;
  }
}

export function CityScene({ data, seed, nowMs, fixedTime }: {
  data: CityData; seed: number; nowMs: number; fixedTime: boolean;
}) {
  const decayTime = sceneDecayTime(data.tasks, nowMs);
  const lots = useMemo(() => makeSceneLots(data, decayTime), [data, decayTime]);
  const blocks = useMemo(() => sceneBlocks(lots), [lots]);
  return <>
    <div className="city-viewport" data-testid="city-scene" role="region" aria-label="3D-карта города">
      <SceneBoundary>
        <Suspense fallback={<p className="scene-notice" role="status">Загружаем 3D-карту…</p>}>
          <Viewport lots={lots} blocks={blocks} seed={seed} nowMs={nowMs} fixedTime={fixedTime} />
        </Suspense>
      </SceneBoundary>
    </div>
    <details className="scene-index">
      <summary>Постройки на карте ({lots.length})</summary>
      {lots.length ? <ul aria-label="Объекты на карте">
        {lots.map(lot => <li key={lot.id}>{lot.title} · {lot.size} · {stageNames[lot.stage]}
          {lot.decay !== "none" && <> · {decayNames[lot.decay]}</>}</li>)}
      </ul> : <p>Здесь появятся постройки командных задач.</p>}
    </details>
  </>;
}
