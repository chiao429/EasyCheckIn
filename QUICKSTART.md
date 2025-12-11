# 快速啟動指南

## 5 分鐘快速開始

### 1. 安裝依賴 (1 分鐘)

```bash
npm install
```

### 2. 設定環境變數 (2 分鐘)

複製環境變數範例檔：

```bash
cp .env.example .env
```

編輯 `.env` 檔案，填入以下資訊：

```env
GOOGLE_CLIENT_EMAIL=你的服務帳號email
GOOGLE_PRIVATE_KEY="你的私鑰"
GOOGLE_SHEET_ID=你的Sheet ID
ADMIN_PASSWORD=admin123
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SHEET_ID=你的Sheet ID
NEXT_PUBLIC_ADMIN_PASSWORD=admin123
```

### 3. 準備測試資料 (1 分鐘)

#### 3.1 活動設定試算表

1. 建立一個 Google Sheet 當作「活動設定表」。
2. 在 `.env` 中設定該表的 ID：

   ```env
   GOOGLE_EVENT_CONFIG_SHEET_ID=你的活動設定表 ID
   ```

3. 在活動設定表中建立欄位（第 1 列）：

   | 欄位 | 名稱       | 說明                            |
   | ---- | ---------- | ------------------------------- |
   | A1   | 活動名稱   | 給人看的名稱                    |
   | B1   | 試算表連結 | 此活動出席名單的 Google Sheet 網址 |
   | C1   | event ID   | 系統用活動代碼，必填且不可重複 |
   | D1   | 備註       | 可選                             |

4. 從第 2 列開始為每個活動填一行資料（至少要填 B / C 欄）。

#### 3.2 出席名單試算表

每個活動對應的出席名單，透過活動設定表 B 欄連結指定，結構需為：

1. 第一列（標題）請依序填入：
   - `序號`
   - `姓名`
   - `到達時間`
   - `已到`
2. 從第二列開始輸入參加者資料（序號與姓名）。

#### 3.3 設定服務帳號權限

在你的 Google Sheet 中：

| 序號 | 姓名 | 到達時間 | 已到 |
|------|------|----------|------|
| 001  | 測試1 |          |      |
| 002  | 測試2 |          |      |
| 003  | 測試3 |          |      |

### 4. 啟動開發伺服器 (1 分鐘)

```bash
npm run dev
```

### 5. 開始使用

開啟瀏覽器訪問：

- **首頁**：http://localhost:3000
- **簽到頁面**：選擇活動產生 QR Code 後，系統會自動產生簽到頁連結
- **管理後台**：選擇活動產生 QR Code 後，系統會自動產生管理後台連結

## 測試流程

### 測試簽到功能

1. 訪問 http://localhost:3000
2. 在左側「產生活動 QR Code」區塊：
   - 從下拉選單選擇一個已在活動設定表中建立的活動
3. 點擊「產生 QR Code」
4. 系統會自動根據該活動設定產出簽到頁、管理後台、Manager、儀表板的連結與 QR Code
5. 將產生的 QR Code 列印出來，提供參加者掃描
6. 參加者掃描 QR Code 後，輸入 `001` 或 `測試1`
7. 點擊「確認簽到」
8. 應該會看到成功訊息
9. 檢查 Google Sheet，應該會看到時間和狀態已更新

### 測試管理後台

1. 訪問 http://localhost:3000
2. 在左側「產生活動 QR Code」區塊：
   - 從下拉選單選擇一個已在活動設定表中建立的活動
3. 點擊「產生 QR Code」
4. 系統會自動根據該活動設定產出簽到頁、管理後台、Manager、儀表板的連結與 QR Code
5. 訪問管理後台連結
6. 輸入密碼：`admin123`
7. 應該能看到：
   - 總人數：3
   - 已簽到：1
   - 未簽到：2
8. 切換不同分頁查看名單
9. 測試搜尋功能
10. 點擊「匯出 CSV」下載報表

## 常見問題快速解決

### 無法連接 Google Sheets

**檢查清單**：
- [ ] 服務帳號 email 已加入 Sheet 的編輯權限
- [ ] `GOOGLE_PRIVATE_KEY` 包含完整的 BEGIN 和 END 標記
- [ ] `GOOGLE_SHEET_ID` 正確（從網址複製）

### 找不到序號或姓名

**檢查清單**：
- [ ] Sheet 的第一列是標題（序號、姓名、到達時間、已到）
- [ ] 資料從第二列開始
- [ ] 輸入的序號/姓名與 Sheet 中完全一致

### 管理後台無法登入

**檢查清單**：
- [ ] `.env` 中的 `ADMIN_PASSWORD` 和 `NEXT_PUBLIC_ADMIN_PASSWORD` 一致
- [ ] 重新啟動開發伺服器

## 下一步

✅ 系統運作正常後，可以：

1. **自訂樣式**：修改 `app/globals.css`
2. **新增功能**：參考 `lib/google-sheets.ts`
3. **部署上線**：參考 `SETUP_GUIDE.md` 的部署章節

## 需要幫助？

- 📖 詳細文件：查看 `README.md`
- 🔧 完整設定：查看 `SETUP_GUIDE.md`
- 🐛 問題回報：開 GitHub Issue

---

**專案**: EasyCheck - 活動點名系統  
**版本**: 1.0.0  
**授權**: MIT License  
**建立日期**: 2024/11/28
