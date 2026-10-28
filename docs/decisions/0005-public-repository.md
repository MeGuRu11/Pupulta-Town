# 0005. Репозиторий публичный

Дата: 2026-10-27. Решил владелец репозитория.

## Решение

Репозиторий `MeGuRu11/Pupulta-Town` публичный.

## Почему

Запретить слияние при красном CI может только защита ветки. Бесплатно она работает лишь в публичных репозиториях, для приватного нужен платный GitHub Pro или Team ([документация GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)). Весь цикл «до зелёного» держится на CI, поэтому выбрали публичный.

## Что из этого следует

- Код, документы и модели видят все. Лицензии нет, поэтому все права остаются за авторами: копировать, распространять и переделывать их никто не вправе, но смотреть и форкать на GitHub может любой ([документация GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)).
- Секреты в репозиторий не попадают никогда: ключи, токены, `.env`.

## Как включить защиту ветки `main`

Делается один раз, после первого прогона CI: GitHub предлагает в списке только те проверки, которые уже запускались.

1. В репозитории: **Settings**, слева **Rules**, затем **Rulesets**, кнопка **New ruleset**, пункт **New branch ruleset** ([документация](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)).
2. Имя: `main`. **Enforcement status**: Active.
3. **Target branches**: Add target, Include default branch.
4. Включить **Require a pull request before merging**. Число обязательных одобрений оставить 0: автор не может одобрить свой pull request, а людей в проекте двое.
5. Включить **Require status checks before merging** и добавить проверки `skills`, `check`, `db`, `e2e`. Пропущенная проверка считается пройденной, поэтому их можно сделать обязательными заранее.
6. Блокировка удаления ветки и force push включена по умолчанию, её оставить.
7. **Bypass list** оставить пустым, иначе правило можно будет обойти.
