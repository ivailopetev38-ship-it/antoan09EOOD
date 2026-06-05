# Hermes · Пълна интеграция A → Я (с „преди / след" на всяка стъпка)

Този документ описва **от край до край** как Hermes се свързва със системата Антоан-09.
Всяка стъпка има: **🔎 ПРЕДИ** (какво трябва да е готово / да провериш), **▶️ ДЕЙСТВИЕ**
(какво да направиш) и **✅ СЛЕД** (как да провериш, че е станало + какво следва / какво при грешка).

---

## Картина от край до край

Има **две посоки** на връзка:

```
1) Hermes  →  приложението        (Hermes ЧЕТЕ данни — вече работи)
   Telegram → Hermes → GET/POST https://antoan09-eood.vercel.app/api/hermes/*

2) приложението  →  Hermes        (за снимки и напомняния — това настройваме)
   /skan или напомняние → POST към твоя сервиз на сървъра:
        HERMES_VISION_URL   (снимка на стикер → данни)
        HERMES_NOTIFY_URL   (текст → Telegram)
```

И двете посоки ползват **един и същ таен токен** `HERMES_API_TOKEN` (Bearer).

---

## ЧАСТ 0 — Токенът (основата за всичко)

### Стъпка 0.1 — Изравни токена
- **🔎 ПРЕДИ:** имаш токена на 2 места: `C:\Users\User\Desktop\hermes-token.txt` (64 hex знака) и във Vercel (`HERMES_API_TOKEN`). Те вече съвпадат.
- **▶️ ДЕЙСТВИЕ:** на сървъра отвори `~/.hermes/.env` и се увери, че редът е точно:
  ```
  ANTOAN09_HERMES_API_TOKEN=<стойността от hermes-token.txt>
  ```
  (без интервали, без кавички, на един ред).
- **✅ СЛЕД:** рестартирай Hermes (`docker restart <hermes-контейнер>` или твоя начин). 
  Проверка: от Telegram прати **„Спарк 0036"** → Hermes трябва да отговори със статуса.
  - При грешка 401 → токенът не съвпада: копирай наново от файла, без скрити интервали.

---

## ЧАСТ 1 — Малък „мост" сервиз на сървъра (за снимки и напомняния)

Hermes-агентът сам не приема HTTP заявки от приложението. Затова пускаме **малък сервиз**
(2 endpoint-а) на същия сървър. ~30 реда код.

### Стъпка 1.1 — Провери какво има на сървъра
- **🔎 ПРЕДИ:** имаш SSH/терминал достъп до сървъра (ttyd на порт 32768 или SSH).
- **▶️ ДЕЙСТВИЕ:** провери, че има Node.js: `node -v` (трябва ≥ 18). Ако няма: `apt install nodejs npm` или ползвай Docker.
- **✅ СЛЕД:** `node -v` връща версия → продължи. Ако не → инсталирай Node 18+.

### Стъпка 1.2 — Вземи нужните тайни (вече ги имаш за Hermes)
- **🔎 ПРЕДИ:** Hermes вече ползва OpenAI ключ + Telegram бот.
- **▶️ ДЕЙСТВИЕ:** намери ги (в `~/.hermes/.env` или конфигурацията на Hermes):
  - `OPENAI_API_KEY` — за разпознаване на снимки.
  - `TELEGRAM_BOT_TOKEN` — на бота на Hermes.
  - `TELEGRAM_CHAT_ID` — chat-а, в който да пристигат напомнянията (твоят/на клиента).
- **✅ СЛЕД:** имаш и трите стойности + токена от 0.1. Ако липсва chat_id: прати съобщение на бота и виж `https://api.telegram.org/bot<TOKEN>/getUpdates` → полето `chat.id`.

### Стъпка 1.3 — Създай сервиза
- **🔎 ПРЕДИ:** Node 18+ е наличен; тайните са събрани.
- **▶️ ДЕЙСТВИЕ:** създай папка и файлове:
  ```bash
  mkdir -p ~/hermes-bridge && cd ~/hermes-bridge
  npm init -y
  npm install express
  ```
  Създай `~/hermes-bridge/server.js`:
  ```js
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const TOKEN   = process.env.HERMES_API_TOKEN;
  const OPENAI  = process.env.OPENAI_API_KEY;
  const TG_TOKEN= process.env.TELEGRAM_BOT_TOKEN;
  const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

  function auth(req, res, next) {
    if ((req.headers.authorization || '') !== `Bearer ${TOKEN}`)
      return res.status(401).json({ error: 'unauthorized' });
    next();
  }

  const PROMPT = `Ти си експерт по пожарогасители. От снимката на стикера извлечи:
  марка(brand), модел(model), сериен номер(serial), година на производство(year, число),
  тип(type: едно от powder_abc, powder_bc, water, foam, co2), капацитет в кг(capacityKg, число),
  гасително вещество(agent), щампи(stamps: масив от {kind: "TO"|"recharge"|"HI", date:"ГГГГ-ММ-ДД"}),
  година до която може да се ползва(scrapYear, число).
  Върни САМО валиден JSON с тези ключове. Липсващо поле = null.`;

  // 1) Разпознаване на стикер
  app.post('/vision', auth, async (req, res) => {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${req.body.imageBase64}` } },
          ]}],
        }),
      });
      const j = await r.json();
      const fields = JSON.parse(j.choices[0].message.content);
      res.json({ fields, confidence: 0.85, raw: j.choices[0].message.content });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // 2) Изпращане на напомняне в Telegram
  app.post('/notify', auth, async (req, res) => {
    try {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT, text: req.body.text }),
      });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.listen(process.env.PORT || 8090, () => console.log('hermes-bridge на :' + (process.env.PORT || 8090)));
  ```
- **✅ СЛЕД:** файловете са създадени. Следва стартиране (1.4).

### Стъпка 1.4 — Стартирай сервиза
- **🔎 ПРЕДИ:** `server.js` е готов; имаш 4-те тайни.
- **▶️ ДЕЙСТВИЕ:** стартирай с env променливите (замести стойностите):
  ```bash
  HERMES_API_TOKEN="<токенът>" OPENAI_API_KEY="<openai>" \
  TELEGRAM_BOT_TOKEN="<бот>" TELEGRAM_CHAT_ID="<chat id>" PORT=8090 \
  node ~/hermes-bridge/server.js
  ```
  (за постоянно: сложи го в `pm2` или systemd, за да не спира: `npm i -g pm2 && pm2 start server.js`).
- **✅ СЛЕД:** в конзолата пише „hermes-bridge на :8090". Тествай локално:
  ```bash
  curl -X POST http://localhost:8090/notify -H "Authorization: Bearer <токенът>" \
    -H "Content-Type: application/json" -d '{"text":"тест от сървъра"}'
  ```
  Трябва да получиш съобщение в Telegram. При 401 → токенът не съвпада. При грешка от Telegram → провери bot token/chat id.

### Стъпка 1.5 — Направи сервиза публично достъпен
- **🔎 ПРЕДИ:** сервизът върви на порт 8090 локално.
- **▶️ ДЕЙСТВИЕ:** трябва Vercel да го достига. Варианти:
  - **(а) Публичен IP + порт:** отвори порт 8090 в защитната стена → URL = `http://<IP-на-сървъра>:8090`.
  - **(б) По-добре HTTPS:** сложи Nginx/Caddy с домейн + сертификат → `https://<домейн>/`.
  - **(в) Бързо за тест:** `cloudflared tunnel --url http://localhost:8090` → дава временен HTTPS URL.
- **✅ СЛЕД:** имаш публичен базов URL. Тествай отвън:
  ```bash
  curl -X POST <ПУБЛИЧЕН-URL>/notify -H "Authorization: Bearer <токенът>" \
    -H "Content-Type: application/json" -d '{"text":"тест отвън"}'
  ```
  Получаваш съобщение → готово за свързване (Част 2).

---

## ЧАСТ 2 — Свържи сервиза към приложението (Vercel)

### Стъпка 2.1 — Дай ми двата URL-а
- **🔎 ПРЕДИ:** публичният URL работи (1.5).
- **▶️ ДЕЙСТВИЕ:** прати ми:
  ```
  HERMES_VISION_URL = <ПУБЛИЧЕН-URL>/vision
  HERMES_NOTIFY_URL = <ПУБЛИЧЕН-URL>/notify
  ```
- **✅ СЛЕД:** аз ги слагам във Vercel (Environment Variables, Production) + правя **redeploy**.
  *(Това е единствената стъпка от моя страна.)*

### Стъпка 2.2 — Демо-fallback се изключва автоматично
- **🔎 ПРЕДИ:** двата URL-а са зададени във Vercel + redeploy е минал.
- **▶️ ДЕЙСТВИЕ:** нищо — кодът сам спира демо-режима, щом URL-ите ги има.
- **✅ СЛЕД:** проверка в Част 3.

---

## ЧАСТ 3 — Финален тест от край до край

### Стъпка 3.1 — Реално разпознаване на снимка
- **🔎 ПРЕДИ:** `HERMES_VISION_URL` е зададен + redeploy.
- **▶️ ДЕЙСТВИЕ:** отвори `https://antoan09-eood.vercel.app/skan`, качи **истинска снимка** на стикер.
- **✅ СЛЕД:** вместо демо „Спарк 0036" трябва да се разпознаят реалните данни от снимката → статус → протокол. При грешка: виж логовете на сервиза (`pm2 logs`).

### Стъпка 3.2 — Реално напомняне
- **🔎 ПРЕДИ:** `HERMES_NOTIFY_URL` е зададен + redeploy.
- **▶️ ДЕЙСТВИЕ:** отвори `/napomnyania` → „Изпрати напомняне".
- **✅ СЛЕД:** съобщението пристига в Telegram (вместо само преглед). При грешка: провери chat_id.

### Стъпка 3.3 — Hermes чете данни (вече работи)
- **🔎 ПРЕДИ:** токенът е изравнен (0.1).
- **▶️ ДЕЙСТВИЕ:** от Telegram: „Спарк 0036", „история на сериен 5487", „кои са за ХИ до 30 дни".
- **✅ СЛЕД:** Hermes отговаря с реални данни. Готово — целият цикъл е затворен.

---

## Обобщена таблица „кой какво прави"

| Нещо | Кой го прави | Статус |
|---|---|---|
| Data API `/api/hermes/*` | Приложението (аз) — Hermes го вика | ✅ живо |
| Токен изравняване | Ти (на сървъра) | стъпка 0.1 |
| Мост-сервиз (vision+notify) | Ти/Codex (на сървъра) | Част 1 |
| `HERMES_VISION_URL`/`HERMES_NOTIFY_URL` във Vercel | Аз | стъпка 2.1 |
| Демо-fallback изключване | Автоматично | стъпка 2.2 |

**Договор за endpoint-ите (детайли):** `docs/hermes-vision-notify-contract.md`.
