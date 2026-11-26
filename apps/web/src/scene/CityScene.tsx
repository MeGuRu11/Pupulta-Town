import { Component, lazy, Suspense, useMemo, type ReactNode } from "react";
import { decayNames, stageNames } from "../components/TaskList.tsx";
import type { CityData } from "../tracker/types.ts";
import { makeSceneLots, sceneBlocks, sceneDecayTime } from "./model.ts";

// Keep the renderer in a separate chunk so the HUD can open while the map loads.
const Viewport = lazy(() => import("./Viewport.tsx"));

export class SceneBoundary extends Component<{ children: ReactNode; message?: string }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  override render() {
    if (!this.state.failed) return this.props.children;
    return <div className="scene-notice" role="status">
      <p>{this.props.message ?? "Не удалось открыть 3D-карту. Объекты и их этапы доступны в разделе «Постройки»."}</p>
      <button className="button button-quiet" onClick={() => this.setState({ failed: false })}>Повторить</button>
    </div>;
  }
}

function useSceneLots(data: CityData, nowMs: number) {
  const decayTime = sceneDecayTime(data.tasks, nowMs);
  return useMemo(() => makeSceneLots(data, decayTime), [data, decayTime]);
}

export function CityScene({ data, seed, nowMs, fixedTime }: {
  data: CityData; seed: number; nowMs: number; fixedTime: boolean;
}) {
  const lots = useSceneLots(data, nowMs);
  const blocks = useMemo(() => sceneBlocks(lots), [lots]);
  return (
    <div className="city-viewport" data-testid="city-scene" role="region" aria-label="3D-карта города">
      <SceneBoundary>
        <Suspense fallback={<p className="scene-notice" role="status">Загружаем 3D-карту…</p>}>
          <Viewport lots={lots} blocks={blocks} seed={seed} nowMs={nowMs} fixedTime={fixedTime} />
        </Suspense>
      </SceneBoundary>
    </div>
  );
}

export function SceneIndex({ data, nowMs }: { data: CityData; nowMs: number }) {
  const lots = useSceneLots(data, nowMs);
  return (
    <details className="scene-index" open>
      <summary>Постройки на карте ({lots.length})</summary>
      {lots.length ? <ul aria-label="Объекты на карте">
        {lots.map(lot => <li key={lot.id}>{lot.title} · {lot.size} · {stageNames[lot.stage]}
          {lot.decay !== "none" && <> · {decayNames[lot.decay]}</>}</li>)}
      </ul> : <p>Здесь появятся постройки командных задач.</p>}
    </details>
  );
}
