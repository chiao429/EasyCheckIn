# EasyCheck - 活動點名系統

一個簡單易用的活動簽到點名系統，使用單一 QR Code 讓所有參加者進行簽到。

## 功能特色

- ✅ **單一 QR Code** - 所有參加者掃描同一個 QR Code
- ✅ **即時簽到** - 自動記錄簽到時間
- ✅ **管理後台** - 即時查看簽到狀況
- ✅ **多種查詢** - 全部/已到/未到名單、搜尋功能
- ✅ **匯出報表** - 支援 CSV 格式匯出
- ✅ **響應式設計** - 手機、平板、電腦都適用

## 技術架構

- **前端框架**: Next.js 14 (App Router)
- **UI 框架**: TailwindCSS + shadcn/ui
- **資料庫**: Google Sheets API
- **部署平台**: Vercel
- **語言**: TypeScript

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定 Google Sheets API

#### 2.1 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 Google Sheets API

#### 2.2 建立服務帳號

1. 在 Google Cloud Console 中，前往「IAM 與管理」→「服務帳號」
2. 點擊「建立服務帳號」
3. 輸入服務帳號名稱（例如：easycheck-service）
4. 點擊「建立並繼續」
5. 角色選擇「編輯者」
6. 點擊「完成」

#### 2.3 產生金鑰

4. 從第 2 列開始，每一列代表一個活動，例如：

   | 活動名稱      | 試算表連結                              | event ID        | 備註         |
   | ------------- | --------------------------------------- | --------------- | ------------ |
   | 2025 Demo Day | https://docs.google.com/.../d/1AbC...  | event_demo_2025 | 對外公開活動 |
   | 年終尾牙      | https://docs.google.com/.../d/1XyZ...  | event_party_25  | 員工限定     |

> 注意：`event ID`（C 欄）之後會出現在網址中，例如 `/checkin/event_demo_2025?...`，請保持唯一且不要留空。

### 3. 建立每場活動的「出席名單試算表」

每個活動在活動設定表 B 欄連結指向的試算表，就是該場的出席名單。這些試算表的結構需相同：

1. 第一列（標題列）請填：
   - `序號`
   - `姓名`
   - `到達時間`
   - `已到`
2. 從第二列開始輸入參加者資料（至少填 `序號` 和 `姓名`）。
3. 將服務帳號 email（`GOOGLE_CLIENT_EMAIL`）加入為這些試算表的「檢視者」或「編輯者」。

### 4. 設定環境變數

複製 `.env.example` 為 `.env`：

```bash
cp .env.example .env
```

編輯 `.env` 檔案，填入以下資訊：

```env
# Google Sheets API 設定
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
GOOGLE_EVENT_CONFIG_SHEET_ID=你的活動設定表的 Sheet ID

# 管理後台密碼
ADMIN_PASSWORD=your-secure-password

# Next.js 設定
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**注意事項：**
- `GOOGLE_CLIENT_EMAIL` 和 `GOOGLE_PRIVATE_KEY` 可以從下載的 JSON 檔案中找到
- `GOOGLE_PRIVATE_KEY` 需要保留換行符號 `\n`
- `GOOGLE_EVENT_CONFIG_SHEET_ID` 是活動設定表的 Sheet ID

### 年度設定管理（選用）

建立「年度設定」分頁，A1:J1 依序填入 `configId`、`年度`、`顯示名稱`、`活動設定試算表 ID`、`Drive 資料夾連結`、`狀態`、`接受簽到`、`建立時間`、`驗證時間`、`已驗證活動對應`。B2 填入目前啟用的 `configId`，第 4 列起填年度資料。L2 由系統存放加密後的 Google OAuth refresh token，勿手動修改或清除。將試算表命名為「年度登記表」並放在 Drive 根資料夾第一層，設定 `GOOGLE_YEAR_ROOT_FOLDER_ID`；既有部署也可用 `GOOGLE_YEAR_REGISTRY_SHEET_ID` 直接指定。另設定 `YEAR_ADMIN_PASSWORD`、隨機的 `YEAR_ADMIN_SESSION_SECRET`、`GOOGLE_OAUTH_CLIENT_ID`、`GOOGLE_OAUTH_CLIENT_SECRET`，以及 OAuth 用戶端允許的 `GOOGLE_OAUTH_REDIRECT_URI`（預設 `http://localhost:3000/api/admin/years/oauth/callback`）。在 Google Cloud OAuth 用戶端中登記完全相同的回呼網址。管理員登入 `/years` 後按「連結 Google 帳號」，使用有權限在年度 Drive 資料夾新增檔案的帳號完成授權；此 OAuth 帳號建立年度活動設定表，服務帳號仍負責年度登記表與活動資料的 Sheets 讀寫。OAuth refresh token 以 `YEAR_ADMIN_SESSION_SECRET` 加密儲存在登記表 L2，因此輪替該密鑰會使既有授權失效，需重新連結。服務帳號仍需可寫入登記表、名單與操作紀錄，可讀取活動設定表，並在 Google Cloud 啟用 Drive API 以確認檔案權限。

1. 在 `/years` 登記原有 2025 活動設定表（年度例如 `2025`、名稱 `2025 聖誕午會`），按「驗證」後啟用。保留 `GOOGLE_EVENT_CONFIG_SHEET_ID` 指向原表，舊 QR Code 依它及原網址的名單 ID 解析。
2. 新增年度時只需貼 Drive 資料夾連結，系統會在資料夾中建立新的「活動設定」試算表（含「工作表1」和「資訊」分頁）。再填入各活動的名單與操作紀錄連結，完成檢查後驗證並啟用。驗證會固定活動 ID、版本及名單與紀錄對應。換名單時建立新設定並重發 QR Code。
3. 回切時選擇 2025 再按「啟用／回切」。兩份名單的記錄留在原表，可獨立設定是否接受新簽到。請依序操作切換，Sheets 的前後回讀可偵測部分衝突，但無法保證多個部署實例之間的互斥。

兩個年度來源變數都未設定時，首頁活動列表沿用 `GOOGLE_EVENT_CONFIG_SHEET_ID`。

### 5. 啟動開發伺服器

```bash
npm run dev
```

開啟瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

## 使用方式

### 產生活動 QR Code

1. 啟動開發伺服器後，開啟 `http://localhost:3000`
2. 在左側「產生活動 QR Code」區塊中：
   - 從「選擇活動」下拉選單中，選擇一個在活動設定表中已建立的活動
3. 點擊「產生 QR Code」
4. 系統會自動根據該活動的設定產出：
   - 參加者簽到頁面連結：`/checkin/{eventId}?sheet={sheetId}`
   - 管理後台連結：`/admin/{eventId}?sheet={sheetId}`
   - Manager 頁面連結：`/manager/{eventId}?sheet={sheetId}`
   - 儀表板連結：`/dashboard/{eventId}?sheet={sheetId}`
   - 簽到頁面的 QR Code 圖片（可下載列印）

### 參加者簽到

1. 掃描 QR Code 進入簽到頁面
2. 輸入報名序號或姓名
3. 點擊「確認簽到」
4. 系統會自動記錄簽到時間

### 管理後台

1. 訪問 `/admin/[eventId]`
2. 輸入管理員密碼
3. 查看簽到狀況：
   - **全部名單** - 顯示所有參加者
   - **已簽到** - 只顯示已簽到的參加者
   - **未簽到** - 只顯示未簽到的參加者
   - **搜尋** - 搜尋特定參加者
4. 點擊「匯出 CSV」下載報表

## 部署到 Vercel

### 1. 推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin your-github-repo-url
git push -u origin main
```

### 2. 在 Vercel 部署

1. 前往 [Vercel](https://vercel.com/)
2. 點擊「Import Project」
3. 選擇你的 GitHub 倉庫
4. 設定環境變數（與 `.env` 相同）
5. 點擊「Deploy」

### 3. 更新環境變數

部署完成後，記得更新 `NEXT_PUBLIC_BASE_URL` 為你的 Vercel 網址：

```env
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
```

## 專案結構

```
EasyCheck/
├── app/
│   ├── api/              # API Routes
│   │   ├── checkin/      # 簽到 API
│   │   ├── attendees/    # 查詢參加者 API
│   │   └── search/       # 搜尋 API
│   ├── checkin/[eventId]/ # 簽到頁面
│   ├── admin/[eventId]/   # 管理後台
│   ├── globals.css       # 全域樣式
│   ├── layout.tsx        # 根佈局
│   └── page.tsx          # 首頁
├── components/
│   └── ui/               # UI 元件
├── lib/
│   ├── google-sheets.ts  # Google Sheets API 整合
│   └── utils.ts          # 工具函數
├── .env.example          # 環境變數範例
├── package.json
├── tailwind.config.ts
└── README.md
```

## 常見問題

### Q: 如何設定管理後台密碼？

A: 年度設定架構的部署必須在伺服器端 `.env` 設定 `ADMIN_PASSWORD`。尚未遷移到年度設定的舊單年度部署，才會暫時從活動設定表 `資訊!A2` 讀取。請不要使用 `NEXT_PUBLIC_ADMIN_PASSWORD`，因為 `NEXT_PUBLIC_` 變數會暴露給瀏覽器。你可以自行把同一組密碼存入 Google 密碼管理員；應用程式不會讀取或寫入密碼管理員。

### Q: 可以同時舉辦多個活動嗎？

A: 可以！每個活動使用不同的 Sheet ID 和活動 ID 即可。

### Q: 簽到資料會儲存在哪裡？

A: 所有資料都儲存在你的 Google Sheet 中，你可以隨時查看和編輯。

### Q: 如何防止重複簽到？

A: 系統會自動檢查，如果該序號/姓名已經簽到過，會顯示錯誤訊息。

### Q: 支援多少人同時簽到？

A: 理論上沒有限制，但建議單一活動不超過 1000 人以確保最佳效能。

## 授權

MIT License

## 支援

如有問題或建議，歡迎開 Issue 或 Pull Request。

---

**專案**: EasyCheck - 活動點名系統  
**版本**: 1.0.0  
**授權**: MIT License  
**建立日期**: 2024/11/28
