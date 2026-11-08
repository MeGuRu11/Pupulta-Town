# Локальная разработка

Все команды ниже выполняются из корня репозитория. Для разработки используется локальный Supabase; подключение к hosted-проекту не требуется.

## Инструменты

| Инструмент | Требование | Где зафиксировано |
| --- | --- | --- |
| Node.js | 22.18 или новее | `engines.node` в `package.json` |
| pnpm | 10.28.0 | `packageManager` в `package.json` |
| Supabase CLI | 3.0.0 | задача `db` в `.github/workflows/ci.yml` |
| Docker | Работающий движок Linux-контейнеров | Требование `supabase start` |
| Docker Desktop на Windows | WSL 2 | Используемый локальный backend |

После установки проверьте версии и ответ Docker Server:

```sh
node --version
pnpm --version
supabase --version
docker info
```

`docker --version` проверяет только клиент. Для запуска Supabase должен отвечать сервер в `docker info`.

## Подготовка проекта

```sh
pnpm install --frozen-lockfile
```

Конфигурация уже находится в `supabase/config.toml`; повторный `supabase init` не нужен. Для базы выбран PostgreSQL 17. Сиды отключены, схема создаётся миграциями из `supabase/migrations/`.

## Адреса и публикация портов

| Сервис | Локальный адрес | Назначение |
| --- | --- | --- |
| Клиент Vite | `http://localhost:5173` | Интерфейс проекта после `pnpm dev` |
| Supabase API | `http://127.0.0.1:54321` | Auth, REST и другие API |
| PostgreSQL | `127.0.0.1:54322` | Подключение к локальной базе |
| Supabase Studio | `http://127.0.0.1:54323` | Управление локальной базой |
| Mailpit | `http://127.0.0.1:54324` | Письма локальной аутентификации |

Это ожидаемые адреса при текущей конфигурации. Доступность проверяется после запуска. Порт `54320` зарезервирован в конфигурации для shadow database.

Для Windows Docker Desktop настройте публикацию новых контейнеров на localhost в разделе сетевых настроек. Документированное значение настройки `portBindingBehavior` — `default-local-port-binding`. После настройки нужны проверка и пересоздание контейнеров: существующие привязки не следует считать изменёнными автоматически. См. [публикацию портов Docker Desktop](https://docs.docker.com/desktop/features/networking/#how-exposed-ports-work) и [справку настройки](https://docs.docker.com/desktop/enterprise/hardened-desktop/settings-management/settings-reference/#port-binding-behavior).

Можно использовать отдельную сеть проекта:

```sh
docker network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 supabase_network_pupulta-town
```

Команда нужна один раз, если сети ещё нет. Наличие сети и её опции проверьте через `docker network inspect supabase_network_pupulta-town`. [Опция bridge-драйвера](https://docs.docker.com/engine/network/drivers/bridge/#default-host-binding-address) задаёт адрес по умолчанию, но на проверенной установке Desktop одной этой опции оказалось недостаточно. Окончательный результат проверяется по фактическим привязкам контейнеров и слушателям Windows.

## Запуск и проверка базы

Запустите Docker Desktop, дождитесь ответа `docker info`, затем выполните:

```sh
supabase start --network-id supabase_network_pupulta-town
pnpm test:db
pnpm dev
```

Если отдельная сеть не создавалась, обычный `supabase start` создаст сеть проекта сам. Флаг `--network-id` позволяет использовать заранее настроенную сеть. Проверка базы запускается на уже работающем локальном Supabase.

`pnpm test:db` сначала сверяет сгенерированные SQL-примеры сетки с исходными примерами, затем запускает pgTAP через `supabase test db --local`. В текущем наборе 183 проверки: 26 + 32 + 125 в трёх SQL-файлах `supabase/tests/`.

Если локальная база уже существовала до появления новой миграции:

```sh
supabase migration up --local
pnpm test:db
```

Для проверки состояния используйте `docker ps` и `supabase status`. В выводе `supabase status` есть параметры подключения и локальные ключи; при передаче диагностики достаточно адресов сервисов и состояния контейнеров.

Проверьте HTTP-доступность API и Studio. Для проверки адресов привязки можно вывести только нужное поле Docker:

```sh
docker inspect supabase_kong_pupulta-town --format '{{json .NetworkSettings.Ports}}'
docker inspect supabase_db_pupulta-town --format '{{json .NetworkSettings.Ports}}'
docker inspect supabase_studio_pupulta-town --format '{{json .NetworkSettings.Ports}}'
```

Для публикации только на этом ПК ожидается `HostIp` равный `127.0.0.1` или `::1`. Значения `0.0.0.0` и `::` означают публикацию на всех соответствующих интерфейсах. Дополнительно на Windows проверьте `LocalAddress` в `Get-NetTCPConnection` для используемых портов.

## Локальная аналитика

В проекте явно задано:

```toml
[analytics]
enabled = false
```

Это отключает локальный сбор сервисных логов через Vector и Logflare. В Windows-ветке [Supabase CLI 3.0.0](https://github.com/supabase/cli/blob/v3.0.0/apps/cli/src/commands/start/services/vector.service.ts) Vector при использовании Docker named pipe пытается обратиться к `host.docker.internal:2375`. На проверенной установке соединение отклонялось и Vector постоянно перезапускался. Для разработки текущего проекта локальная аналитика не требуется; логи контейнеров доступны в Docker Desktop и через `docker logs`.

Параметр `analytics.enabled` описан в [конфигурации Supabase](https://supabase.com/docs/guides/local-development/cli/config#analyticsenabled). После изменения конфигурации требуется остановка и новый запуск Supabase. Открывать Docker API по TCP 2375 для этого проекта не нужно.

## Остановка и общие проверки

Для обычной остановки с сохранением данных:

```sh
supabase stop
```

Перед завершением работы Docker Desktop останавливайте через меню приложения. Обычная остановка Supabase сохраняет данные; флаг `--no-backup` предназначен для их удаления. См. [справку Supabase stop](https://supabase.com/docs/reference/cli/introduction#supabase-stop).

Общие проверки репозитория:

```sh
pnpm verify
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm verify` включает typecheck, lint, Vitest и проверку `.glb`. Проверки базы запускаются отдельно командой `pnpm test:db`.

Установка Chromium нужна при подготовке среды и при смене требуемой Playwright версии браузера. Если браузер уже установлен в отдельном кеше, задайте тот же `PLAYWRIGHT_BROWSERS_PATH` при запуске теста. См. [управление браузерами Playwright](https://playwright.dev/docs/browsers#managing-browser-binaries).

## Windows: запуск Docker из Codex

Если Docker при запуске из оболочки агента завершается на `Secrets Engine`, `engine.sock` или другом Unix-сокете внутри AppData, запустите Docker Desktop из меню «Пуск» или через Windows Explorer. В пользовательском [issue Codex #52698](https://github.com/openai/codex/issues/52698) описана связанная с MSIX виртуализация AppData. На проверенной установке запуск через Explorer позволил движку ответить на `docker info`. Это наблюдение для конкретного ПК; одинаковый текст ошибки на другой системе сам по себе не подтверждает ту же причину.

Для установки Docker только для текущего пользователя команда PowerShell выглядит так:

```powershell
$dockerDesktop = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/Docker Desktop.exe'
Start-Process -FilePath explorer.exe -ArgumentList ('"{0}"' -f $dockerDesktop) -WindowStyle Hidden
```

При установке для всех пользователей путь может отличаться. После запуска проверяйте `docker info`. Подтверждённый обход не требует удаления сокетов, смены ACL или сброса данных Docker.

## Переносимые инструменты на текущем ПК

Этот пример относится только к рабочей папке `D:/ChatGPT`; он не задаёт обязательные пути для остальных участников. Supabase CLI 3.0.0 и pnpm подготовлены в соседнем каталоге кеша. Чтобы использовать их в текущем окне PowerShell:

```powershell
Set-Location -LiteralPath 'D:/ChatGPT/Pupulta-Town-study'
$env:COREPACK_HOME = 'D:/ChatGPT/Pupulta-Town-study-cache/corepack'
$env:Path = 'D:/ChatGPT/Pupulta-Town-study-cache/supabase-cli-3.0.0;D:/ChatGPT/Pupulta-Town-study-cache/bin;' + $env:Path
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:/ChatGPT/Pupulta-Town-study-cache/playwright'
pnpm --version
supabase --version
```

Изменяется только окружение этого процесса. Перед запуском Supabase команда `docker` также должна быть доступна в `PATH`. Для указанной установки Docker её каталог — `%LOCALAPPDATA%/Programs/DockerDesktop/resources/bin`.

Основной официальный порядок работы: [локальный Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started) и [команды CLI](https://supabase.com/docs/reference/cli/introduction).
