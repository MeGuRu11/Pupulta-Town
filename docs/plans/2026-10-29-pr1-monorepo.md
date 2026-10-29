# План: PR 1 первого среза — каркас монорепозитория

Задача: PR 1 из [плана первого среза](2026-10-28-first-slice.md). Делается в облачном треде проекта, поэтому `pnpm verify` и ревью по чек-листу `reviewer.md` запускаются вручную, без хуков и субагентов.

## Что меняем

1. Корень pnpm-монорепозитория: `package.json` со скриптами из `AGENTS.md`, `pnpm-workspace.yaml`, общий `tsconfig` со `strict`.
2. Три пакета без логики: `@pupulta/web` (React + Vite, страница-заглушка), `@pupulta/sim`, `@pupulta/shared`. Пакеты отдают исходники `.ts` напрямую, без сборки: их собирает Vite в `apps/web`.
3. ESLint с правилами-инвариантами для `packages/sim`:
   - запрет импорта `three`, `react`, `react-dom`, `@react-three/*`, клиентов сети (`@supabase/*`, `colyseus.js`) и встроенных модулей Node;
   - запрет `Math.random`, `Date.now`, `performance.now`, `new Date()` и `Date()` без аргумента;
   - запрет глобалов браузера и сети (`window`, `document`, `fetch`, `WebSocket`, `crypto` и другие);
   - `tsconfig` пакета без `DOM` в `lib`, поэтому DOM ловит ещё и `pnpm typecheck`.
4. Vitest в корне на все `*.test.ts`, Playwright в корне на `apps/web/e2e/*.spec.ts`.
5. `scripts/check-assets.ts`: в `assets/` лежат только `.glb`, каждый — корректный контейнер glTF 2.0. Проверки габаритов, точки опоры, имён узлов и бюджета полигонов появятся вместе с первой моделью: проверять их сейчас не на чем.
6. Скрипт `verify` = typecheck, lint, test, check:assets.
7. CI: в задаче `e2e` поднимать Supabase (`supabase start`), когда в репозитории есть `supabase/config.toml`. Сейчас его нет, шаг пропускается; включится сам в PR 3.
8. `AGENTS.md`, раздел «Команды»: команды теперь есть, кроме `pnpm test:db` (появится с базой в PR 3).

## Файлы

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `tsconfig.json`
- `eslint.config.js`, `eslint.config.test.ts`
- `vitest.config.ts`, `playwright.config.ts`
- `apps/web/`: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `e2e/smoke.spec.ts`
- `packages/sim/`, `packages/shared/`: `package.json`, `tsconfig.json`, `src/index.ts`
- `scripts/check-assets.ts`, `scripts/check-assets.test.ts`, `assets/.gitkeep`
- `.github/workflows/ci.yml`, `.gitignore`, `AGENTS.md`

## Какие тесты докажут результат

- `eslint.config.test.ts` (Vitest, через API ESLint): каждый запрещённый приём в файле из `packages/sim` даёт ошибку линтера, чистый код ошибок не даёт, тот же `Math.random()` в `apps/web` разрешён. Тест пишется первым и падает, пока правил нет. Это автоматическая версия ручной проверки из плана среза.
- Ручная проверка из плана среза: файл с `Math.random()` в `packages/sim` роняет `pnpm lint`. Результат — в описании PR.
- `scripts/check-assets.test.ts`: пустая и отсутствующая папка проходят; правильный `.glb` проходит; файл не `.glb`, битая сигнатура, glTF версии 1 и неверная длина дают ошибку.
- `apps/web/e2e/smoke.spec.ts`: страница открывается, заголовок виден. Нужен, чтобы задача CI `e2e` проверяла реальный запуск приложения, а не падала на «нет тестов».
- `pnpm verify` и `pnpm test:e2e` зелёные локально, CI зелёный.

## Чего не делаем

- Нет `supabase/`, `pnpm test:db` и задачи CI `db`: это PR 3.
- Нет логики в `sim` и `shared`: это PR 2.
- Нет React Three Fiber и three: это PR 5, после прототипа толпы.
