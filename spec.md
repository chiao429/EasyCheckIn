# EasyCheckIn 程式架構說明

活動報到系統，分為**大人版（同工）**與**兒童版**兩套平行的頁面與 API，資料全部存放在 Google 試算表。

- 正式網址：https://easy-checkin-seven.vercel.app（Vercel 專案 `easy-checkin`）
- 原始碼：https://github.com/chiao429/EasyCheckIn

---

## 1. 技術組成

| 項目 | 內容 |
|---|---|
| 框架 | Next.js 14（App Router）＋ React 18 ＋ TypeScript |
| 樣式 | Tailwind CSS，元件放在 `components/ui/`（button、card、input） |
| 圖示 | lucide-react |
| QR Code | `qrcode` 套件（首頁產生報到連結 QR） |
| 資料 | Google Sheets API v4（`googleapis`），以 service account 存取 |
| 部署 | Vercel |

---

## 2. 目錄結構

```
EasyCheckIn/
├── app/
│   ├── page.tsx                      首頁（大人版）：選活動、產生報到連結與 QR Code
│   ├── kids/page.tsx                 兒童版首頁：同上
│   ├── checkin/[eventId]/            大人版：參加者自助報到
│   ├── admin/[eventId]/              大人版：管理後台（需密碼）
│   ├── manager/[eventId]/            大人版：現場工作人員工具
│   ├── dashboard/[eventId]/          大人版：儀表板
│   ├── kids-check/[eventId]/         兒童版：現場主責人員名單（取消、不會出席、聯繫狀態）
│   ├── kids-admin/[eventId]/         兒童版：管理後台（需密碼）
│   ├── kids-manager/[eventId]/       兒童版：現場工作人員工具（含小隊地點查詢）
│   ├── kids-dashboard/[eventId]/     兒童版：儀表板（含小隊篩選）
│   ├── privacy/                      隱私權說明
│   ├── icon-preview/                 圖示預覽（開發用）
│   └── api/                          API Routes（見第 5 節）
├── components/                       SiteFooter、ui 元件
├── lib/
│   ├── google-sheets.ts              所有 Google Sheets 讀寫邏輯
│   └── utils.ts                      cn() 等工具
└── public/
    └── groupSchedule.json            兒童版小隊時間表（小隊 → 各時段區域、時間、地點）
```

---

## 3. 資料來源（Google 試算表）

系統用到三種試算表。

### 3.1 活動設定試算表（環境變數 `GOOGLE_EVENT_CONFIG_SHEET_ID`）

**活動清單**：第一個分頁，從第 2 列開始讀 `A2:F`。

| 欄 | 內容 |
|---|---|
| A | 活動名稱 |
| B | 活動試算表連結 |
| C | eventId（網址中使用） |
| D | 備註 |
| E | 操作紀錄（log）試算表連結 |
| F | 版本：`同工` 或 `兒童` |

**`資訊` 分頁**：`資訊!A2` 存放後台登入密碼（大人版與兒童版共用）。

### 3.2 活動試算表（每場活動一份）

**大人版**：第一個分頁，以**欄位位置**讀取。

| 欄 | 內容 | 說明 |
|---|---|---|
| A | 序號 | |
| B | 姓名 | |
| C | 到達時間 | 報到時寫入 |
| D | 已到 | `TRUE` 已報到；`CANCELLED` 不會來；`晚到` 晚到；空白為未報到 |
| E–I | 其他欄位 | 例如性別、所屬小組、聯絡組（G 欄）、聯絡電話，原樣顯示為詳細資料 |

**兒童版**：第一個分頁，欄位位置不同。

| 欄 | 內容 | 說明 |
|---|---|---|
| A | 已到 | `TRUE` 已報到；`CANCELLED` 不會出席；空白為未報到 |
| B | 到達時間 | |
| C–D | 其他 | D 欄開始做為詳細資料 |
| E | 報名序號 | |
| F | 兒童姓名 | |
| G–T | 其他欄位 | 家長姓名、電話、小隊等，原樣顯示 |
| U | 是否已聯繫 | `TRUE` 已聯繫；空白為待聯繫 |

> ⚠️ 程式依欄位位置（A、B、E、F、U…）讀寫，在試算表中插入或刪除欄位會讓系統讀錯欄。

**兒童版「小隊時間表」分頁**（選用）：活動試算表中名為 `小隊時間表` 的分頁，必須放在名單分頁之後（程式讀名單時讀的是第一個分頁）。

| 小隊 | 區域 | 開始 | 結束 | 地點 |
|---|---|---|---|---|
| D001 | 綠區 | 09:41 | 09:56 | 玩具城的點亮行動（K中） |

### 3.3 操作紀錄試算表（每場活動一份，連結填在設定表 E 欄）

系統會自動建立標題列：`時間, 操作人員, 動作, 序號, 姓名, 操作結果, 備註`

會記錄代為簽到、取消簽到、標記不會來、標記晚到、切換聯繫狀態、後台登入、系統錯誤與警告。

---

## 4. 頁面功能

### 大人版
| 頁面 | 使用者 | 功能 |
|---|---|---|
| `/` | 管理者 | 從設定表載入活動，產生報到網址與 QR Code |
| `/checkin/[eventId]` | 參加者 | 輸入姓名（或序號）自助報到 |
| `/admin/[eventId]` | 管理者 | 密碼登入；名單（全部／已到／未到）、搜尋、代為報到、取消報到、標記不會來、匯出 CSV、壓力測試紀錄 |
| `/manager/[eventId]` | 現場工作人員 | 輸入工作人員名字（記在瀏覽器）；搜尋、代為報到、取消、標記不會來、標記晚到 |
| `/dashboard/[eventId]` | 管理者 | 總數、已到、未到、晚到、不會來統計；名單分頁；標記晚到；顯示設定記在瀏覽器 |

### 兒童版
| 頁面 | 使用者 | 功能 |
|---|---|---|
| `/kids` | 管理者 | 兒童版活動入口與 QR Code |
| `/kids-check/[eventId]` | 現場主責人員 | 名單、即時搜尋、取消報到、標記不會出席、切換已聯繫／待聯繫、匯出 CSV、日誌試算表連結 |
| `/kids-admin/[eventId]` | 管理者 | 密碼登入；名單、代為報到、取消、標記不會出席、匯出 CSV |
| `/kids-manager/[eventId]` | 現場工作人員 | 搜尋並報到（同戶兄弟姊妹可勾選一起報到）、報到後彈出報名資訊並保留上一筆紀錄、取消、標記不會出席；依活動試算表「小隊時間表」分頁查詢小隊目前所在地點（沒有分頁時用 `groupSchedule.json`） |
| `/kids-squad/[eventId]` | 小隊長 | 選擇自己的小隊（記在裝置上，不需密碼），只顯示該隊：目前位置、統計、隊員名單；每位隊員可報到、取消、標記不會出席、切換聯繫狀態（不處理兄弟姊妹） |
| `/kids-dashboard/[eventId]` | 管理者 | 統計（含晚到、聯繫狀態）、小隊篩選（記在瀏覽器） |

**活動試算表的指定方式**：頁面依序取用網址參數 `?sheet=`，沒有的話用 eventId。後台另外會透過 `/api/admin/event-sheets` 查詢設定表中的活動試算表與日誌連結。

---

## 5. API

所有 API 都在 `app/api/`，回傳格式為 `{ success, message?, data? }`。

### 共用
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/events/list` | 讀設定表 `A2:F`，回傳活動清單 |
| GET | `/api/admin/event-sheets?eventId=` | 回傳該活動的試算表連結與日誌連結 |
| POST | `/api/admin/login` | `{ password, eventId }`，比對 `資訊!A2`，並寫入登入紀錄 |
| POST | `/api/admin/log-loadtest-summary` | 寫入壓力測試結果摘要到日誌 |

### 大人版
| 方法 | 路徑 | 說明 | 寫入 |
|---|---|---|---|
| GET | `/api/attendees?sheetId=&filter=` | 名單，filter 可為 all／checked／unchecked | — |
| GET | `/api/search?sheetId=&query=` | 序號完全符合優先，否則姓名包含 | — |
| POST | `/api/checkin` | `{ identifier, sheetId, eventId?, operator? }` | C、D ← 時間、`TRUE` |
| POST | `/api/manager/cancel-checkin` | 取消報到 | C、D ← 空白 |
| POST | `/api/manager/mark-cancelled` | 標記不會來 | C、D ← 空白、`CANCELLED` |
| POST | `/api/manager/mark-late` | 切換晚到；已報到者不能標記（409） | D ← `晚到` 或空白 |

### 兒童版
| 方法 | 路徑 | 說明 | 寫入 |
|---|---|---|---|
| GET | `/api/kids/attendees?sheetId=&filter=` | 名單（讀到 U 欄） | — |
| GET | `/api/kids/search?sheetId=&query=` | 搜尋，有 10 秒記憶體快取 | — |
| POST | `/api/kids/checkin` | `{ identifier, sheetId, rowIndex? }`，有 rowIndex 時直接寫該列 | A、B ← `TRUE`、時間 |
| POST | `/api/kids/manager/cancel-checkin` | 取消報到 | A、B ← 空白 |
| POST | `/api/kids/manager/mark-cancelled` | 標記不會出席 | A、B ← `CANCELLED`、空白 |
| GET | `/api/kids/squad/roster?sheetId=&squad=` | 只回傳該小隊名單與時間表（名單 10 秒快取） | — |
| GET | `/api/kids/schedule?sheetId=` | 讀「小隊時間表」分頁（30 秒快取），沒有分頁時回傳 `source: file` | — |
| POST | `/api/kids/family` | 找出家長電話相同的兄弟姊妹 | — |
| POST | `/api/kids/checkin/batch` | 同戶一次報到（最多 10 位），已報到者略過 | A、B ← `TRUE`、時間 |
| POST | `/api/kids/manager/toggle-contact` | 切換已聯繫；家長姓名欄為合併儲存格時，會往下補齊再比對 | U ← `TRUE` 或空白 |

### 保護機制
- **報到限流**：`/api/checkin` 與 `/api/kids/checkin` 在每個伺服器執行個體內，每秒最多處理 45 次，超過回傳 429。
- **快取**：兒童版搜尋有 10 秒記憶體快取，報到成功時同步更新快取。
- **錯誤紀錄**：各 API 發生錯誤時寫入日誌試算表，動作為「系統錯誤」或「系統警告」。

---

## 6. 核心模組：`lib/google-sheets.ts`

| 函式 | 用途 |
|---|---|
| `getGoogleSheetsClient()` | 以 service account 建立 Sheets 客戶端 |
| `extractSheetIdFromUrl()` | 從試算表網址取出 ID |
| `getAdminPasswordFromConfigSheet()` | 讀 `資訊!A2` 後台密碼 |
| `getAllAttendees()` / `searchAttendee()` / `checkIn()` / `initializeSheet()` | 大人版讀取、搜尋、報到、初始化標題 |
| `getAllKidsAttendees()` / `searchKidsAttendee()` / `checkInKids()` | 兒童版讀取、搜尋、報到 |
| `logManagerAction()` | 依 eventId 找到日誌試算表並新增一筆紀錄 |

報到與修改狀態的流程：讀取整個範圍 → 以序號或姓名找出列號 → 寫入該列的指定欄位。

---

## 7. 認證與權限

- **後台登入**：admin 與 kids-admin 頁面呼叫 `/api/admin/login` 驗證密碼，成功後把登入狀態存在瀏覽器 localStorage（`easycheckin_admin_session`、`easycheckin_kids_admin_session`）。
- **工作人員名字**：manager 頁面把工作人員名字存在 localStorage，寫入日誌的「操作人員」欄。
- **其他頁面不需登入**：dashboard、kids-check、kids-manager、checkin 都不需要登入。

---

## 8. 環境變數

| 變數 | 說明 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | service account email |
| `GOOGLE_PRIVATE_KEY` | service account 私鑰（換行以 `\n` 表示） |
| `GOOGLE_EVENT_CONFIG_SHEET_ID` | 活動設定試算表 ID |
| `GOOGLE_SHEET_ID` | 舊設定：頁面在沒有 `?sheet=` 時的備用值 |
| `NEXT_PUBLIC_BASE_URL` | 首頁產生報到連結用的網址，未設定時使用目前網域 |
| `ADMIN_JWT_SECRET` | 目前程式中沒有使用 |

> 本機 `.env` 的 service account 金鑰已經無法使用（Google 回應 `account not found`），正式環境以 Vercel 上設定的值為準。

---

## 9. 已知限制

1. **API 沒有權限檢查**：只要知道活動試算表 ID，任何人都能直接呼叫 API 讀取名單或修改報到狀態。後台密碼只擋在前端頁面，localStorage 的登入狀態也可以手動偽造。
2. **欄位位置寫死**：大人版依 A–D 欄、兒童版依 A、B、E、F、U 欄讀寫，試算表不能任意調整欄位。
3. **用列號寫入**：先讀資料、算出列號再寫入，若期間有人在試算表排序或插入列，可能寫到錯的人。
4. **大人版與兒童版重複**：兩套頁面與 API 邏輯幾乎相同，只差欄位位置，維護時要改兩份。
5. **限流與快取只在單一執行個體內有效**：Vercel 同時開多個執行個體時，各自計算。
6. **小隊時間表**：已改為讀活動試算表的「小隊時間表」分頁（欄位：小隊、區域、開始、結束、地點，依標題對應）；只有沒有這個分頁的活動才會用 `public/groupSchedule.json`。
7. **已到欄位一欄多用**：大人版 D 欄同時表示已到、不會來、晚到，無法同時記錄「晚到」與「已聯繫」等多種狀態。

> 新系統 `/Users/jo/kidsSystem` 的報到系統（apps/checkin）已針對以上問題重新設計：依標題名稱讀寫、依 ID 更新、帳號角色登入、狀態分欄記錄、時間表放在試算表。
