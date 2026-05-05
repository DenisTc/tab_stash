# TabStash — Design Spec

**Date:** 2026-05-05
**Status:** Approved (brainstorm)
**Repo:** https://github.com/DenisTc/tab_stash

## Problem

Pet-project автора регулярно накапливает большое количество открытых вкладок в Chrome. Хочется иметь возможность массово закрыть их, не теряя URL, и при необходимости вернуть обратно или скопировать список как plain-текст.

## Goals

- Сохранять выбранные вкладки в именованные папки внутри расширения.
- Восстанавливать вкладки (по одной или всю папку).
- Получать список URL папки как plain-текст в буфере обмена.
- Минимум зависимостей и ноль build-шага.

## Non-Goals (MVP)

- Синхронизация между устройствами (`chrome.storage.sync` слишком мал для метаданных вкладок; локального хранилища достаточно).
- Импорт/экспорт между разными форматами (Pocket, Pinboard, OneTab).
- Полнотекстовый поиск.
- Тёмная тема (CSS-переменные закладываются, но фактический тёмный стиль — позже).
- Поддержка хоткеев на сохранение (`chrome.commands`) — на потом.
- E2E-тестирование (Playwright). Только unit + ручной чек-лист.

## User Flows

### Сохранение

1. Юзер кликает иконку расширения → открывается Side Panel в режиме `Library`.
2. Кликает таб `Save` (или кнопку «+ Save current tabs» на Library).
3. Save view рендерит:
   - Если в текущем окне есть **highlighted** вкладки (выделенные через Cmd/Ctrl+клик) — список содержит только их, чекбоксы стоят по умолчанию.
   - Иначе — все вкладки текущего активного окна, чекбоксы пустые. Кнопки `All` / `None`.
   - Pinned-вкладки **исключены** из списка по умолчанию.
   - Поле `Folder name` с автокомплитом (`<datalist>` существующих имён).
   - Чекбокс `Close tabs after saving`.
   - Кнопка `Save N tabs` (disabled, пока нет имени и хотя бы одной отмеченной вкладки).
4. По нажатию `Save`:
   - `lib/storage.js` создаёт папку (если нет) и добавляет вкладки с дедупликацией по URL внутри папки.
   - Если стоял чекбокс «Close» — `lib/tabs.js` закрывает соответствующие вкладки.
   - Панель переключается в `Library`. Тост: `Saved 4 tabs to ‘Работа’` (или `Saved 3 (1 was already in folder)` при дубликатах).

### Просмотр библиотеки

1. Library — master view. Список папок: имя, кол-во вкладок, дата последнего обновления.
2. Клик по папке → drilldown в Folder Detail (с back-стрелкой).
3. Folder Detail: action row (`Open all` · `Copy` · `⋮`), список вкладок (favicon · title · url).
4. Меню `⋮`: `Rename`, `Delete folder`, `Export folder as JSON` (опц., on roadmap).

### Восстановление вкладок

- **Клик по одной вкладке** → `chrome.tabs.create({ url, active: false })`. Открывается фоном, фокус не уходит.
- **Open all** → модалка с двумя кнопками: `Open in current window (background)` (default) и `Open in new window`. Если в папке > 20 вкладок — заголовок модалки уточняет: `This will open N tabs.`

### Копирование как текст

- `Copy` в Folder Detail → `lib/format.js` собирает все URL построчно (plain text) → `navigator.clipboard.writeText(...)` → тост `Copied N URLs`.
- Fallback: если clipboard API недоступен — модалка с pre-выделенной textarea.

### Удаление

- Удалить одну вкладку: hover → появляется `×` → клик → undo-тост 5 сек.
- Удалить папку: `⋮` → `Delete folder` → confirm-модалка `Delete folder ‘X’ and N tabs?` → каскадное удаление → возврат в Library.
- Переименовать папку: `⋮` → `Rename` → инлайн-инпут с проверкой уникальности.

## Architecture

### Stack

- **Manifest V3** (требование Chrome для новых расширений).
- **Side Panel API** (`chrome.sidePanel`) — единственный UI.
- **Storage:** `chrome.storage.local` (≈10 МБ лимит; для нашего объёма — с большим запасом).
- **Vanilla JS + HTML + CSS**, без сборки и без зависимостей в production.
- **Background service worker** — открытие панели по клику на иконку, чтение `chrome.storage` event-driven для синхронизации между окнами (если открыто несколько).

### Файловая структура

```
tab_stash/
├── manifest.json
├── background.js                      # service worker
├── sidepanel/
│   ├── sidepanel.html
│   ├── sidepanel.css                  # CSS-переменные для темы
│   ├── sidepanel.js                   # роутер view'ов
│   ├── views/
│   │   ├── save.js                    # Save view
│   │   ├── library.js                 # master folder list
│   │   └── folder.js                  # folder detail
│   └── lib/
│       ├── storage.js                 # CRUD над chrome.storage.local
│       ├── tabs.js                    # обёртка над chrome.tabs
│       ├── format.js                  # plain-text + clipboard
│       └── uuid.js                    # crypto.randomUUID() wrapper
├── icons/                             # 16/32/48/128 PNG
├── tests/                             # unit-тесты (vitest или node:test)
├── docs/superpowers/specs/            # эта спека
├── package.json                       # только dev-deps (vitest)
├── .gitignore
└── README.md
```

### Permissions (manifest)

- `tabs` — читать список открытых вкладок.
- `storage` — `chrome.storage.local`.
- `sidePanel` — Side Panel API.
- `clipboardWrite` — копирование текста (требуется в MV3 даже для `navigator.clipboard.writeText`).

Не требуются: `<all_urls>`, `host_permissions`, `scripting`.

### Принципы разделения

- `lib/*` — чистые модули, без DOM. Покрываются unit-тестами.
- `views/*` — DOM, рендеринг, обработка кликов. Используют `lib/*`.
- `sidepanel.js` — простой роутер, переключающий какой view отрисован.
- `lib/storage.js` — единственный путь к `chrome.storage`. View'ы никогда не трогают storage напрямую.

## Data Model

Хранится в `chrome.storage.local` под единственным ключом `data`:

```ts
type SavedTab = {
  id: string;          // crypto.randomUUID()
  title: string;
  url: string;
  favIconUrl?: string;
  savedAt: number;     // Date.now()
};

type Folder = {
  id: string;          // crypto.randomUUID()
  name: string;        // unique
  createdAt: number;
  updatedAt: number;
  tabs: SavedTab[];    // newest first
};

type Storage = {
  schemaVersion: 1;    // для будущих миграций
  folders: Folder[];   // newest first
};
```

**Инварианты:**

- Имена папок уникальны (case-sensitive). Проверка при создании и переименовании.
- В пределах одной папки URL уникальны (дедупликация при добавлении).
- При удалении папки — каскадное удаление всех её вкладок.

**Миграции:**
`lib/storage.js` при чтении проверяет `schemaVersion`. Если меньше текущей — прогоняет цепочку `migrate_1_to_2(...)` и т.д., и сохраняет обратно.

## Edge Cases

| Случай | Поведение |
|---|---|
| Дубликат URL в папке при сохранении | Тихо пропускаем, в тосте показываем счётчик. |
| Пустое имя папки | Кнопка `Save` disabled. |
| Конфликт имени при rename | Inline-ошибка под полем. |
| `Open all` для большой папки (> 20) | Доп. подтверждение в модалке. |
| Сохранение `chrome://`, `about:`, `file://` URL | Сохраняем; при Open показываем тост о невозможности — Chrome сам не пустит расширение туда. |
| Clipboard API недоступен | Fallback: модалка с pre-выделенной textarea. |
| Storage quota exceeded | Тост + кнопка перехода в Library для очистки. |
| Несколько окон Chrome | Save view работает с **текущим активным окном** (определяется через `chrome.windows.WINDOW_ID_CURRENT`). |
| Pinned tabs | Исключаются из выбора по умолчанию. |
| Случайное удаление | Undo-тост на 5 секунд. По истечении — реальное удаление. |

## Testing Strategy

### Unit-тесты (`lib/*`)

Используем `vitest` (или `node:test` без зависимостей — решим в плане). `chrome.*` API мокается в setup-файле.

- **storage.js**: создание папки, дедупликация при addTabs, rename с проверкой уникальности, каскад при deleteFolder, миграции.
- **format.js**: plain-text формат, пустой список, спец-символы.
- **tabs.js**: мокаем `chrome.tabs.query/create/remove`, проверяем корректные вызовы (фильтрация pinned, current window).

Цель: 100% line coverage на `lib/`.

### Интеграционный smoke-чек-лист (вручную)

Чек-лист в `docs/superpowers/specs/manual-smoke-test.md`. Прогоняется перед коммитом тегированных версий:

1. Установить unpacked. Открыть панель. Сохранить N вкладок. Проверить через DevTools `chrome.storage.local.get('data')`.
2. Перезапустить Chrome — данные на месте.
3. Открыть одну вкладку из папки. Открыть всю папку.
4. Скопировать как текст. Проверить буфер обмена.
5. Переименовать папку. Удалить вкладку. Undo. Удалить папку.
6. Сохранить вкладки во второй раз в ту же папку — дедупликация работает.

### Не входит в MVP

- Playwright/E2E (overkill).
- Performance тесты (объём данных мал).
- A11y-аудит (на следующей итерации).

## Roadmap (post-MVP)

- Тёмная тема через `prefers-color-scheme`.
- Хоткей сохранения через `chrome.commands` (default `Cmd/Ctrl+Shift+S`).
- Поиск по папкам и вкладкам.
- Drag-n-drop вкладок между папками.
- Экспорт папки как JSON / OPML.
- Опциональный включающий pinned-tabs режим.

## Open Questions

(Не блокируют MVP, но стоит решить в плане имплементации.)

- Что выбрать для unit-тестов: `vitest` (удобный API, 1 dependency) или `node:test` (zero deps)? Склоняюсь к `vitest` за DX.
- Нужен ли `web-ext lint` в pre-commit? Скорее да, но сделаем после первого зелёного билда.
