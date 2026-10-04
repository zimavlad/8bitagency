# Деплой і перевірка

Секретів тут нема: значення — у Coolify, у локальному `.env` (не в git) або в змінних середовища сесії.

## Де живе гра

- Адреса: https://8bitagency.91.99.8.73.sslip.io (HTTPS від Let's Encrypt через Traefik), вхід за паролем.
- Coolify: проєкт `myvjs2gabizimsezjwrxwdzu`, застосунок `8bitagency`, uuid `6nhhj4epymmejq04xjg2kymr`.
  Public repository https://github.com/zimavlad/8bitagency, гілка `claude/8bit-agency-simulation-VlcSI`,
  build pack `dockerfile`, порт 3000 (на хост не пробрасується).
- Том `6nhhj4epymmejq04xjg2kymr-data` → `/data`: `save.json` і база знань `knowledge/<роль>/`.
  На хості: `/var/lib/docker/volumes/6nhhj4epymmejq04xjg2kymr-data/_data`.

## Змінні (лише назви)

`ANTHROPIC_API_KEY`, `GAME_PASSWORD`, `DATA_DIR=/data`, `PORT=3000`, `HOST=0.0.0.0`,
`PROTOCOL_HEADER=x-forwarded-proto`, `HOST_HEADER=x-forwarded-host`, `ADDRESS_HEADER=x-forwarded-for`, `XFF_DEPTH=1`.
Необовʼязкові: `AGENCY_MODEL`, `REVIEW_MODEL`, `CLIENT_MODEL`, `GPT_MODEL`.

## Деплой

Автодеплою нема. Після push у гілку:

    curl -X POST -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_API_URL/api/v1/deploy?uuid=6nhhj4epymmejq04xjg2kymr"
    # далі GET $COOLIFY_API_URL/api/v1/deployments/<deployment_uuid> до status=finished

Збірка ~30 с, простій 15–20 с; активний бриф після редеплою губиться (гра — ні).
Перенос у `main`: спершу `PATCH …/applications/6nhhj4epymmejq04xjg2kymr {"git_branch":"main"}`, потім деплой.

Хмарна сесія Claude Code не може деплоїти сама: API Coolify — це `http` на порту 8000, а проксі сесії
не передає токен через незахищене зʼєднання. Деплой — із сесії на Маці або через інтерфейс Coolify.

## База знань

    scp файл.pdf root@91.99.8.73:/var/lib/docker/volumes/6nhhj4epymmejq04xjg2kymr-data/_data/knowledge/strategist/

Ролі: `strategist`, `copywriter`, `designer`. Підхоплюється без перезапуску.

## Живі перевірки на справжньому Claude

    LIVE_CLAUDE=1 ANTHROPIC_API_KEY=… npx vitest run src/lib/server/game/live.test.ts       # кожен тип запиту, ~$0.05
    LIVE_CLAUDE=1 ANTHROPIC_API_KEY=… npx vitest run src/lib/server/game/live-full.test.ts  # повний бриф, ~$0.4, ~2 хв

## Граблі

- Описи полів (`description`) у JSON-схемі на моделях 5.5 дають `stop_reason: refusal` з порожньою
  відповіддю. Схема йде в API без описів (`bare()`), підказка про поля — текстом у запиті (`guide()`).
