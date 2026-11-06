# Пупульта Town — рабочая среда Codex

Исходная документация перенесена из проекта Claude 27 октября 2026 года. С 6 ноября рабочую среду ведём в Codex по [решению 0013](decisions/0013-codex-only.md). Настройка, с которой начинался проект, сохранена в [истории Git](https://github.com/MeGuRu11/Pupulta-Town/blob/48a02ad972123efe5e74a2698126b88562f5e757/docs/ai-environment.md).

## Начало работы

1. Откройте корень репозитория в Codex. Подойдёт приложение, CLI или расширение IDE. Общие инструкции лежат в [AGENTS.md](../AGENTS.md). Codex ищет эти файлы от корня проекта до текущей папки. [Документация AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
2. Проверьте содержимое `.codex/` и пометьте проект доверенным для загрузки его настроек. Для локального хука отдельно проверьте и подтвердите команду в интерфейсе проверки хуков Codex. В CLI этот интерфейс открывается командой `/hooks`. Изменённое определение хука требует новой проверки. [MCP в Codex](https://learn.chatgpt.com/docs/extend/mcp), [хуки и доверие](https://learn.chatgpt.com/docs/hooks).
3. Поставьте Node.js 22.18 или новее и используйте версию pnpm из поля `packageManager` в [package.json](../package.json). Из корня запустите `pnpm install --frozen-lockfile` и `pnpm verify`. Для браузерных тестов установите Chromium командой `pnpm exec playwright install chromium`, затем выполните `pnpm test:e2e`. Для тестов базы после появления миграций нужны Docker и Supabase CLI.
4. Для каждой задачи заведите отдельную ветку. Перед коммитом выполните проверки по [AGENTS.md](../AGENTS.md), затем откройте PR. Владелец или товарищ проверяет результат и сливает его по правилам `main`.

## Файлы проекта

| Где | Что определяет |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Цикл работы, инварианты, команды, требования к ревью |
| [.agents/skills/](../.agents/skills/) | Проектные скиллы и их ресурсы. Codex находит их в репозитории |
| [.codex/config.toml](../.codex/config.toml) | Общие MCP-серверы проекта для доверенного рабочего каталога |
| [.codex/agents/](../.codex/agents/) | Проектные определения ролей `reviewer` и `tester` |
| [.codex/hooks.json](../.codex/hooks.json) | Локальный хук `Stop` для дополнительной проверки перед завершением |
| [.codex/rules/](../.codex/rules/) | Ограничения для распознаваемых команд при выполнении вне песочницы |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | Проверки PR и изменений в `main` |

Доступность MCP, локальных хуков и запуска субагентов зависит от среды Codex и настроек доступа. Перед задачей проверьте, какие инструменты доступны в этом сеансе. Локальные процессы вроде Playwright MCP и Blender MCP требуют доступа к компьютеру, на котором они запущены. [Документация MCP](https://learn.chatgpt.com/docs/extend/mcp), [документация субагентов](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Работа с изменениями

Для задачи больше одного файла запишите в `docs/plans/` план с изменяемыми файлами и проверками. Для новой логики сначала воспроизведите проблему тестом, затем сделайте изменение и прогоните `pnpm verify`. Для изменений браузерного сценария добавьте прогон `pnpm test:e2e`. В PR опишите сделанное, проверки и границы изменения. [Правила проекта](../AGENTS.md).

- **Основной агент** ведёт задачу, собирает выводы помощников и отвечает за проверки.
- **`reviewer`** ищет нарушения инвариантов, регрессии и пробелы в тестах. Возвращает замечания с путём и строкой, без правок.
- **`tester`** пишет и запускает тесты. Область его работы задана инструкцией роли, а основной агент проверяет её соблюдение по diff.

Роли подключаются через встроенный запуск субагентов Codex. Они помогают, когда можно работать параллельно. Если запуск субагентов в сеансе недоступен, основной агент сам проходит чек-лист ревью и выполняет проверки. [Проектные роли](../.codex/agents/), [настройка субагентов](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Хук `Stop` запускает `pnpm verify` в рабочем дереве с изменениями при установленных зависимостях. При ошибке он один раз возвращает агенту результат для исправления. Перед коммитом запускайте проверку явно. Обязательные проверки перед слиянием обеспечивает GitHub. [Конфигурация хука](../.codex/hooks.json) · [Правила ветки](https://github.com/MeGuRu11/Pupulta-Town/rules/26044728)

Локальные правила Codex ограничивают распространённые формы `supabase db push` и принудительного `git push` при сопоставлении команд. Инструкции проекта действуют и для других форм этих команд. [Правила Codex](https://learn.chatgpt.com/docs/agent-configuration/rules) · [Ограничения проекта](../AGENTS.md)

## MCP-серверы

| Сервер | Как используется |
| --- | --- |
| Context7 | Документация библиотек, например Three.js, React Three Fiber, Supabase и Playwright |
| OpenAI Developer Docs | Документация OpenAI и Codex |
| Playwright | Работа с локальным браузером в режиме `--headless --isolated`. Для тестов CI применяется Playwright из зависимостей репозитория |

[Общий MCP-конфиг](../.codex/config.toml), [Playwright MCP](https://github.com/microsoft/playwright-mcp), [OpenAI Developer Docs MCP](https://developers.openai.com/mcp).

### Dev Supabase

Для чтения схемы, логов или диагностических данных подключите MCP конкретного dev-проекта в личном `~/.codex/config.toml`. Используйте URL вида `https://mcp.supabase.com/mcp?project_ref=YOUR_DEV_PROJECT_REF&read_only=true&features=database,docs,debugging,development`, где `YOUR_DEV_PROJECT_REF` заменён на ID вашего dev-проекта. В TOML задайте этот адрес полем `url` в разделе `[mcp_servers.supabase]`. Аутентифицируйтесь при запросе клиента Codex и проверьте область доступа. [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp), [настройка MCP в Codex](https://learn.chatgpt.com/docs/extend/mcp).

Схему меняем новой миграцией в репозитории и проверяем на локальном Supabase. Удалённые окружения обновляет человек. Доступ через MCP разрешён только к dev-проекту и только на чтение. Секреты остаются в личных настройках. [Правила базы](../AGENTS.md), [скилл db-change](../.agents/skills/db-change/SKILL.md).

### Blender

Для экспорта модели используйте [скилл glb-asset](../.agents/skills/glb-asset/SKILL.md) и его скрипт. Для работы с открытой сценой Blender MCP можно подключить отдельно на своём компьютере. Дополнение устанавливается по инструкции Blender Lab, сервер запускается через `uv`. После клонирования репозитория сервера добавьте в личный `~/.codex/config.toml`:

```toml
[mcp_servers.blender]
command = "uv"
args = ["--directory", "<локальный-путь>/blender_mcp/mcp", "run", "blender-mcp"]
```

MCP работает с открытым Blender и может выполнять Python в сцене. Blender Lab рекомендует изолированную среду для недоверенного кода. Начните с тестовой сцены, если хотите проверить соединение. [Blender Lab](https://www.blender.org/lab/mcp-server/), [установка сервера](https://projects.blender.org/lab/blender_mcp/wiki/Setup), [исходный план](plans/2026-10-28-blender-mcp.md).

## Скиллы

Скиллы проекта хранятся в одном каталоге `.agents/skills/`. [Документация Codex](https://learn.chatgpt.com/docs/build-skills).

| Скилл | Когда применять |
| --- | --- |
| [db-change](../.agents/skills/db-change/SKILL.md) | Изменение таблиц, функций или RLS. В одном PR идут миграция и тесты pgTAP на разрешённые и запрещённые действия |
| [glb-asset](../.agents/skills/glb-asset/SKILL.md) | Экспорт и проверка модели из Blender по контракту города |

Superpowers и дополнительные тематические скиллы могут быть личными инструментами. Проектная установка для них не нужна. Оценка дополнительных скиллов от 29 октября, вместе с условиями для будущего подключения, осталась в [предыдущей редакции документа](https://github.com/MeGuRu11/Pupulta-Town/blob/48a02ad972123efe5e74a2698126b88562f5e757/docs/ai-environment.md#L178-L205).

## CI и защита ветки

| Проверка | Что делает |
| --- | --- |
| `skills` | Запускает тесты валидатора и проверяет проектные скиллы командой `node scripts/check-skills.mjs` |
| `check` | Устанавливает зависимости по lockfile, запускает типы, линтер, Vitest и проверку ассетов при наличии `package.json` |
| `db` | Поднимает локальный Supabase и запускает pgTAP при наличии `supabase/config.toml` |
| `e2e` | Запускает Playwright в Chromium. Поднимает Supabase, когда в репозитории появляется его конфигурация |

GitHub запускает CI для pull request и push в `main`. Правила `main` требуют PR и успешных обязательных проверок. Имя `skills` сохранено при смене проверяемого содержимого. [Workflow](../.github/workflows/ci.yml), [правила ветки](https://github.com/MeGuRu11/Pupulta-Town/rules/26044728).
