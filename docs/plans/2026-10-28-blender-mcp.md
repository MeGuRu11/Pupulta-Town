# План: ИИ в Blender (MCP-сервер и экспорт в скилле glb-asset)

Задача владельца 28 октября 2026: найти скиллы и MCP-серверы для работы ИИ с Blender. Сравнение лежит в документе [«ИИ и Blender: MCP-серверы и скиллы»](https://claude.ai/artifact/29sZ4eGRsw7iB11gDd1sMN). Владелец и товарищ работают в Blender 5.2.3 LTS из Steam.

## Что меняем

1. Подключаем официальный MCP-сервер Blender Lab, но не в `.mcp.json` репозитория, а в личные настройки каждого. Сервер локальный: у того, у кого не запущен Blender, он только мешает.
2. В скилл `glb-asset` добавляем раздел «Экспорт из Blender»: настройки экспортёра glTF, скрипт экспорта без окна и правила для Blender 5.x.
3. В `docs/ai-environment.md` описываем сервер, его риски и установку.

Чужие скиллы не ставим: их соглашения об именах и сжатии расходятся с нашим контрактом ассетов.

## Файлы

- `.agents/skills/glb-asset/SKILL.md` и копия `.claude/skills/glb-asset/SKILL.md` (через `node scripts/sync-skills.mjs`)
- `.agents/skills/glb-asset/export_glb.py` и копия в `.claude/skills/glb-asset/`
- `docs/ai-environment.md`
- `docs/art-direction.md`: оси при экспорте теперь проверены, метка [Likely] сменилась на [Certain]
- `docs/plans/2026-10-28-blender-mcp.md` (этот файл)

## Как проверяем

- Скрипт экспорта из скилла запускаем на Blender 5.2.3 без окна (пакет `bpy==5.2.3` с PyPI): куб 2 × 2 × 2 м с узлом `stage_0_foundation` экспортируется в `.glb`, в файле ось Y вверх, узел на месте, габарит 2 м.
- `node scripts/sync-skills.mjs --check` проходит.
- `pnpm verify` пока не существует: в репозитории ещё нет `package.json`.

## Чего не делаем

- Не ставим сервер в `.mcp.json` и `.codex/config.toml`.
- Не пишем скрипт проверки сцены в `scripts/`: те же проверки по готовому `.glb` делает `pnpm check:assets` из плана первого среза.
