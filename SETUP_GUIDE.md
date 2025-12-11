# EasyCheck 設定指南

## 完整設定步驟

### 步驟 1: 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊頂部的專案選擇器
3. 點擊「新增專案」
4. 輸入專案名稱（例如：EasyCheck）
5. 點擊「建立」

### 步驟 2: 啟用 Google Sheets API

1. 在左側選單中，選擇「API 和服務」→「資料庫」
2. 點擊「+ 啟用 API 和服務」
3. 搜尋「Google Sheets API」
4. 點擊「Google Sheets API」
5. 點擊「啟用」

### 步驟 3: 建立服務帳號

1. 在左側選單中，選擇「IAM 與管理」→「服務帳號」
2. 點擊「+ 建立服務帳號」
3. 填寫服務帳號詳細資料：
   - **服務帳號名稱**：easycheck-service
   - **服務帳號 ID**：會自動產生
   - **描述**：EasyCheck 活動點名系統服務帳號
4. 點擊「建立並繼續」
5. 選擇角色：
   - 點擊「選取角色」
   - 搜尋「編輯者」或選擇「基本」→「編輯者」
6. 點擊「繼續」
7. 點擊「完成」

### 步驟 4: 產生並下載金鑰

1. 在服務帳號列表中，找到剛建立的服務帳號
2. 點擊服務帳號的 email
3. 切換到「金鑰」分頁
4. 點擊「新增金鑰」→「建立新金鑰」
5. 選擇金鑰類型：**JSON**
6. 點擊「建立」
7. JSON 檔案會自動下載到你的電腦

### 步驟 5: 準備 Google Sheet

1. 前往 [Google Sheets](https://sheets.google.com/)
2. 點擊「空白」建立新試算表
3. 重新命名試算表（例如：活動點名-2024春季）
4. 在第一列（A1:D1）輸入標題：

   | A | B | C | D |
   |---|---|---|---|
   | 序號 | 姓名 | 到達時間 | 已到 |

5. 從第二列開始輸入參加者資料（範例）：

   | A | B | C | D |
   |---|---|---|---|
   | 001 | 王小明 | | |
   | 002 | 李小華 | | |
   | 003 | 張小美 | | |

   **注意**：只需填寫「序號」和「姓名」，「到達時間」和「已到」會由系統自動填寫。

6. 複製 Sheet ID：
   - 查看網址列
   - Sheet ID 是 `/d/` 和 `/edit` 之間的字串
   - 例如：`https://docs.google.com/spreadsheets/d/1ABC...XYZ/edit`
   - Sheet ID 就是 `1ABC...XYZ`

7. 分享 Sheet 給服務帳號：
   - 點擊右上角「共用」按鈕
   - 在「新增使用者和群組」中，貼上服務帳號的 email
     （格式：`easycheck-service@your-project.iam.gserviceaccount.com`）
   - 權限選擇「編輯者」
   - **取消勾選**「通知使用者」
   - 點擊「共用」

### 步驟 6: 設定環境變數

1. 開啟下載的 JSON 金鑰檔案
2. 找到以下欄位：
   - `client_email`
   - `private_key`

3. 複製 `.env.example` 為 `.env`：
   ```bash
   cp .env.example .env
   ```

4. 編輯 `.env` 檔案：

   ```env
   # 從 JSON 檔案的 client_email 欄位複製
   GOOGLE_CLIENT_EMAIL=easycheck-service@your-project.iam.gserviceaccount.com
   
   # 從 JSON 檔案的 private_key 欄位複製（保留引號和換行符號）
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE...\n-----END PRIVATE KEY-----\n"
   
   # 你的 Google Sheet ID
   GOOGLE_SHEET_ID=1ABC...XYZ
   
   # 設定管理後台密碼（自訂）
   ADMIN_PASSWORD=your-secure-password
   
   # 本地開發網址
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   
   # 公開的環境變數（與上面相同）
   NEXT_PUBLIC_SHEET_ID=1ABC...XYZ
   NEXT_PUBLIC_ADMIN_PASSWORD=your-secure-password
   ```

### 步驟 7: 安裝依賴並啟動

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

開啟瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

### 步驟 8: 測試系統

1. **產生 QR Code**：
   - 在首頁輸入活動 ID（例如：test2024）
   - 點擊「產生 QR Code」
   - 下載 QR Code

2. **測試簽到**：
   - 掃描 QR Code 或直接訪問 `http://localhost:3000/checkin/test2024`
   - 輸入你在 Sheet 中設定的序號或姓名（例如：001 或 王小明）
   - 點擊「確認簽到」
   - 應該會看到成功訊息

3. **檢查 Google Sheet**：
   - 回到 Google Sheet
   - 應該會看到「到達時間」和「已到」欄位已自動填寫

4. **測試管理後台**：
   - 訪問 `http://localhost:3000/admin/test2024`
   - 輸入管理員密碼
   - 應該能看到簽到統計和名單

## 部署到 Vercel

### 步驟 1: 推送到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/easycheck.git
git push -u origin main
```

### 步驟 2: 在 Vercel 部署

1. 前往 [Vercel](https://vercel.com/)
2. 使用 GitHub 帳號登入
3. 點擊「Add New...」→「Project」
4. 選擇你的 GitHub 倉庫（easycheck）
5. 點擊「Import」

### 步驟 3: 設定環境變數

在 Vercel 的專案設定中，新增以下環境變數：

```
GOOGLE_CLIENT_EMAIL=easycheck-service@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1ABC...XYZ
ADMIN_PASSWORD=your-secure-password
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
NEXT_PUBLIC_SHEET_ID=1ABC...XYZ
NEXT_PUBLIC_ADMIN_PASSWORD=your-secure-password
```

**重要提示**：
- 在 Vercel 設定 `GOOGLE_PRIVATE_KEY` 時，需要保留換行符號 `\n`
- 可以直接從 JSON 檔案複製貼上，Vercel 會自動處理

### 步驟 4: 部署

1. 點擊「Deploy」
2. 等待部署完成（約 1-2 分鐘）
3. 部署成功後，會得到一個網址（例如：`https://easycheck.vercel.app`）

### 步驟 5: 更新 BASE_URL

1. 在 Vercel 專案設定中
2. 找到 `NEXT_PUBLIC_BASE_URL` 環境變數
3. 更新為你的 Vercel 網址
4. 點擊「Save」
5. 重新部署專案

## 疑難排解

### 問題 1: 無法連接到 Google Sheets

**可能原因**：
- 服務帳號沒有 Sheet 的編輯權限
- `GOOGLE_PRIVATE_KEY` 格式不正確

**解決方法**：
1. 確認服務帳號的 email 已加入 Sheet 的編輯權限
2. 確認 `GOOGLE_PRIVATE_KEY` 包含完整的 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`
3. 確認換行符號 `\n` 沒有被移除

### 問題 2: 簽到時顯示「找不到此序號或姓名」

**可能原因**：
- Sheet 中沒有該筆資料
- 輸入的序號或姓名不完全符合

**解決方法**：
1. 檢查 Sheet 中的資料是否正確
2. 確認輸入的序號或姓名與 Sheet 中完全一致（包括空格）

### 問題 3: 管理後台無法登入

**可能原因**：
- 密碼設定不正確
- 環境變數沒有正確載入

**解決方法**：
1. 確認 `.env` 檔案中的 `ADMIN_PASSWORD` 和 `NEXT_PUBLIC_ADMIN_PASSWORD` 一致
2. 重新啟動開發伺服器

### 問題 4: Vercel 部署後無法運作

**可能原因**：
- 環境變數沒有正確設定
- `NEXT_PUBLIC_BASE_URL` 還是 localhost

**解決方法**：
1. 檢查 Vercel 專案設定中的所有環境變數
2. 確認 `NEXT_PUBLIC_BASE_URL` 是 Vercel 網址
3. 重新部署專案

## 進階設定

### 自訂網域

1. 在 Vercel 專案設定中，選擇「Domains」
2. 點擊「Add」
3. 輸入你的網域名稱
4. 按照指示設定 DNS 記錄
5. 等待 DNS 生效（可能需要幾小時）

### 多活動管理

如果要同時管理多個活動：

1. 為每個活動建立獨立的 Google Sheet
2. 每個活動使用不同的 Sheet ID
3. 在產生 QR Code 時，使用不同的活動 ID
4. 可以在 `.env` 中設定預設的 Sheet ID，或在 URL 中指定

### 自訂樣式

修改 `app/globals.css` 中的 CSS 變數來自訂顏色主題：

```css
:root {
  --primary: 221.2 83.2% 53.3%;  /* 主色調 */
  --secondary: 210 40% 96.1%;    /* 次要色調 */
  /* ... 其他顏色 */
}
```

## 安全性建議

1. **不要將 `.env` 檔案提交到 Git**
   - 已在 `.gitignore` 中排除
   
2. **使用強密碼**
   - 管理後台密碼應該使用強密碼
   
3. **定期更換金鑰**
   - 建議每 3-6 個月更換一次服務帳號金鑰
   
4. **限制服務帳號權限**
   - 只給予必要的 Sheet 編輯權限
   
5. **使用 HTTPS**
   - Vercel 自動提供 HTTPS，確保資料傳輸安全

## 支援

如有任何問題，歡迎：
- 開 GitHub Issue
- 查看 README.md 中的常見問題
- 聯繫開發團隊

---

**專案**: EasyCheck - 活動點名系統  
**版本**: 1.0.0  
**授權**: MIT License  
**建立日期**: 2024/11/28
