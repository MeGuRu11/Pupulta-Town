import { useMemo, useState } from "react";
import { HudIcon } from "../components/HudIcon.tsx";
import { SceneBoundary } from "./CityScene.tsx";
import { Scenery } from "./Scenery.tsx";
import Viewport from "./Viewport.tsx";
import { makeTowerParts, type TowerStage, type TowerDecay } from "./towerParts.ts";
import { measureTowerOcclusion, studyBlocks, studyLots, towerCenter } from "./towerStudy.ts";
import "./towerPrototype.css";

const studyTime = Date.UTC(2030, 0, 1, 12);

export default function TowerPrototype() {
  const [stage, setStage] = useState<TowerStage>("complete");
  const [decay, setDecay] = useState<TowerDecay>("none");
  const [floors, setFloors] = useState(8);
  const [rotation, setRotation] = useState(0);
  const isFoundation = stage === "foundation";
  const builtFloors = isFoundation ? 0 : floors;
  const side = ((rotation % 4) + 4) % 4;
  const parts = useMemo(() => makeTowerParts(stage, floors, decay), [stage, floors, decay]);
  const hidden = useMemo(() => measureTowerOcclusion(side, parts), [side, parts]);

  return <main className="game-workspace tower-study">
    <div className="game-world">
      <div className="city-viewport" data-testid="city-scene" role="region" aria-label="3D-карта города">
        <SceneBoundary message="Не удалось открыть 3D-карту. Расчёт видимости участков доступен в панели башни.">
          <Viewport lots={studyLots} blocks={studyBlocks} seed={42} nowMs={studyTime} fixedTime onRotationSettled={setRotation}>
            <group position={[towerCenter.x, 0, towerCenter.z]}><Scenery parts={parts} /></group>
          </Viewport>
        </SceneBoundary>
      </div>
    </div>
    <header className="game-top">
      <div className="hud-city"><HudIcon name="city" /><div><small>Пупульта Town</small><h1>Башня L</h1></div></div>
      <a className="tower-return" href="/"><HudIcon name="home" />В город</a>
    </header>
    <aside className="tower-inspector" aria-label="Параметры башни">
      <div className="tower-inspector-title"><h2>Макет башни</h2><p>Участок 6 × 6 клеток · 12 × 12 м</p></div>
      <div className="tower-inputs">
        <label>Этап строительства
          <select value={stage} onChange={event => setStage(event.target.value as TowerStage)}>
            <option value="foundation">Фундамент</option><option value="construction">Строительные леса</option>
            <option value="complete">Готовое здание</option>
          </select>
        </label>
        <div className="tower-floors">
          <label htmlFor="tower-floors">Этажи</label><output htmlFor="tower-floors">{builtFloors}</output>
          <input id="tower-floors" type="range" min={isFoundation ? 0 : 1} max="15" value={builtFloors} disabled={isFoundation}
            aria-describedby="tower-floor-note" onChange={event => setFloors(event.target.valueAsNumber)} />
          <p id="tower-floor-note">{isFoundation ? "Этажи появятся на следующем этапе." : "От 1 до 15 · высота этажа 3 м"}</p>
        </div>
        <label>Порча
          <select value={decay} onChange={event => setDecay(event.target.value as TowerDecay)}>
            <option value="none">Без порчи</option><option value="dirt">Грязь</option>
            <option value="graffiti">Граффити</option><option value="defect">Дефект</option>
          </select>
        </label>
      </div>
      <div className="tower-reading">
        <p className="tower-bearing"><HudIcon name="compass" />Ракурс {side + 1} из 4</p>
        <h3>За башней</h3>
        <p className="tower-count" data-testid="tower-occlusion"><strong>{hidden.length}</strong> из {studyLots.length}</p>
        <p>Столько центров соседних участков на уровне земли закрывает башня.</p>
        {hidden.length > 0 && <details><summary>Какие участки?</summary><ul>{hidden.map(name => <li key={name}>{name}</li>)}</ul></details>}
      </div>
    </aside>
  </main>;
}
