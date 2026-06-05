# Hermes ↔ Антоан-09 · Договор за Vision + Notify endpoint-и

Приложението (Vercel) вика **Hermes** (на сървъра) за две неща. Hermes-страната трябва
да изложи два HTTP endpoint-а. Когато са готови, се задават `HERMES_VISION_URL` и
`HERMES_NOTIFY_URL` във Vercel → приложението автоматично спира демо-fallback-ите и
почва да ползва Hermes.

**Авторизация (и за двата):** хедър `Authorization: Bearer <HERMES_API_TOKEN>` —
**същият токен** като в `~/.hermes/.env` и във Vercel. Без него → 401.

---

## 1) Vision — разпознаване на стикер

**Заявка (app → Hermes):**
```
POST <HERMES_VISION_URL>
Authorization: Bearer <HERMES_API_TOKEN>
Content-Type: application/json

{ "imageBase64": "<base64 на снимката, без data: префикс>",
  "task": "extinguisher_sticker", "schemaVersion": 1 }
```

**Отговор 200:**
```json
{
  "fields": {
    "brand": "Sparky | null",
    "model": "Спарк 6 кг | null",
    "serial": "0036 | null",
    "year": 2022,
    "type": "powder_abc | powder_bc | water | foam | co2 | null",
    "capacityKg": 6,
    "agent": "Кобра ABC 50 | null",
    "stamps": [{ "kind": "TO | recharge | HI", "date": "YYYY-MM-DD" }],
    "scrapYear": 2037
  },
  "confidence": 0.0,
  "raw": "разчетен текст от стикера"
}
```
- `type`: прахов ABC→`powder_abc`, прахов BC→`powder_bc`, воден→`water`, водопенен→`foam`, CO₂→`co2`.
- `stamps.kind`: ТО→`TO`, презареждане/смяна→`recharge`, хидростатично→`HI`. Дати ISO.
- Полета, които не се четат → `null` (приложението ги попълва на ръка).

**Реализация (подсказка):** endpoint-ът праща снимката към OpenAI vision (моделът на
Hermes, напр. `gpt-4o`) с промпт на български: „Извлечи от стикера на пожарогасителя:
марка, модел, сериен №, година на производство, тип, капацитет (кг), гасително
вещество, и всички щампи с вид (ТО/презареждане/ХИ) и дата. Върни само валиден JSON
по схемата." → връща JSON-а по-горе.

---

## 2) Notify — изпращане на напомняне в Telegram

**Заявка (app → Hermes):**
```
POST <HERMES_NOTIFY_URL>
Authorization: Bearer <HERMES_API_TOKEN>
Content-Type: application/json

{ "text": "готовият текст на напомнянето" }
```
**Действие:** Hermes праща `text` в Telegram (на собственика/клиента). **Отговор 200** `{ "ok": true }`.

---

## 3) Включване във Vercel (когато endpoint-ите са готови)
```
HERMES_VISION_URL = https://<сървър>/vision
HERMES_NOTIFY_URL = https://<сървър>/notify
```
След задаване → **redeploy**. Готово: реалните снимки се четат, напомнянията се пращат.
(Базов URL на приложението за справки на Hermes: `https://antoan09-eood.vercel.app`.)
