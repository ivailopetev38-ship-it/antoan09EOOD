# Hermes ↔ Антоан-09 интеграция

Защитени endpoint-и, които дават на Hermes (AI агента) достъп до данните на системата
и до генерирането на протокол. Hermes ги ползва като „инструменти" от Telegram.

## Защита

Всички `/api/hermes/*` изискват хедър:

```
Authorization: Bearer <HERMES_API_TOKEN>
```

`HERMES_API_TOKEN` е споделена тайна. Задава се:
- в **приложението** → Vercel → Project Settings → Environment Variables
- в **Hermes** → като env/secret на агента (същата стойност)

Генериране на силен токен: `openssl rand -hex 32`. Без токен → `401`. Ако в приложението липсва → `500`.

## Endpoints

### `GET /api/hermes/search?q=<текст>`
Търси пожарогасители по модел, сериен №, обект, клиент, категория (всички думи трябва да съвпадат).
```bash
curl -H "Authorization: Bearer $T" "$BASE/api/hermes/search?q=Спарк%200036"
```
Връща: `{ count, results: [{ serial_number, model, siteName, clientName, status, ... }] }`

### `GET /api/hermes/due?site=<обект>&action=<TO|recharge|HI>&withinDays=<N>`
Просрочени + предстоящи (по подразбиране до 30 дни). Всички филтри са по избор.
```bash
curl -H "Authorization: Bearer $T" "$BASE/api/hermes/due?site=Складове%20Дунав&action=HI&withinDays=30"
```

### `POST /api/hermes/query`  body: `{ "q": "<въпрос>" }`
Естествен език → разпознава намерение и връща готов текстов отговор + данни.
Поддържа: търсене, „за обслужване" справки, „история на сериен …", „колко са за брак".
```bash
curl -X POST -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"q":"Кои на обект Складове Дунав са за ХИ до 30 дни?"}' "$BASE/api/hermes/query"
```
Връща: `{ intent, answer, data }`

### `POST /api/hermes/protocol`  body: `{ "siteId": "<uuid>", "extinguisherId": "<uuid?>" }`
Генерира `.docx` протокол (Приложение № 9). Без `extinguisherId` → за целия обект.
Връща бинарен `.docx` (Content-Disposition: attachment).

## Архитектура

- `src/lib/hermes/auth.ts` — Bearer проверка (timing-safe).
- `src/lib/hermes/data.ts` — search / due / count / by-serial (върху `getEnrichedExtinguishers`).
- `src/lib/hermes/query.ts` — NL разпознаване (чисти, тестваеми helper-и) + dispatcher.
- `src/lib/protocol/build.ts` — споделено сглобяване на протокол (ползва се и от `/api/protocols/generate`).

## Деплой стъпки
1. Push → Vercel deploy.
2. Vercel env: `HERMES_API_TOKEN=<дълъг случаен низ>` (+ вече наличните Supabase ключове).
3. Hermes (на сървъра): същият `HERMES_API_TOKEN` + базовият URL `https://antoan09-eood.vercel.app`.
4. Тест от Telegram: „Спарк 0036", „история на сериен 5487", „кои са за ХИ до 30 дни", генериране на протокол.
