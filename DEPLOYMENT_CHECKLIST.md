# 部署檢查清單

## 部署前準備

### Google Sheets 設定
- [ ] 已建立 Google Cloud 專案
- [ ] 已啟用 Google Sheets API
- [ ] 已建立服務帳號
- [ ] 已下載 JSON 金鑰檔案
- [ ] 已建立 Google Sheet
- [ ] Sheet 第一列標題正確：序號、姓名、到達時間、已到
- [ ] 已輸入參加者資料（序號和姓名）
- [ ] 已將服務帳號 email 加入 Sheet 的編輯權限
- [ ] 已複製 Sheet ID

### 本地測試
- [ ] 已安裝所有依賴 (`npm install`)
- [ ] 已設定 `.env` 檔案
- [ ] 本地開發伺服器可以正常啟動 (`npm run dev`)
- [ ] 簽到功能測試通過
- [ ] 管理後台可以正常登入
- [ ] 資料可以正確寫入 Google Sheet
- [ ] QR Code 可以正常產生

### 程式碼準備
- [ ] 已推送所有程式碼到 GitHub
- [ ] `.env` 檔案已加入 `.gitignore`（不要上傳）
- [ ] 已確認沒有硬編碼的敏感資訊
- [ ] 已測試 build 指令 (`npm run build`)

## Vercel 部署步驟

### 1. 連接 GitHub
- [ ] 已註冊/登入 Vercel
- [ ] 已連接 GitHub 帳號
- [ ] 已選擇正確的倉庫

### 2. 設定環境變數

在 Vercel 專案設定中新增以下環境變數：

#### 必要變數
- [ ] `GOOGLE_CLIENT_EMAIL` - 服務帳號 email
- [ ] `GOOGLE_PRIVATE_KEY` - 私鑰（保留 \n 換行符號）
- [ ] `GOOGLE_SHEET_ID` - Sheet ID
- [ ] `ADMIN_PASSWORD` - 管理員密碼
- [ ] `NEXT_PUBLIC_BASE_URL` - Vercel 網址（例如：https://your-app.vercel.app）
- [ ] `NEXT_PUBLIC_SHEET_ID` - Sheet ID（與上面相同）
- [ ] `NEXT_PUBLIC_ADMIN_PASSWORD` - 管理員密碼（與上面相同）

#### 環境變數設定提示
```
GOOGLE_CLIENT_EMAIL=your-service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=1ABC...XYZ
ADMIN_PASSWORD=your-secure-password
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
NEXT_PUBLIC_SHEET_ID=1ABC...XYZ
NEXT_PUBLIC_ADMIN_PASSWORD=your-secure-password
```

### 3. 部署設定
- [ ] Framework Preset: Next.js
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `.next`
- [ ] Install Command: `npm install`
- [ ] Development Command: `npm run dev`

### 4. 執行部署
- [ ] 點擊 "Deploy" 按鈕
- [ ] 等待建置完成（約 1-2 分鐘）
- [ ] 檢查建置日誌是否有錯誤

## 部署後測試

### 基本功能測試
- [ ] 訪問首頁可以正常顯示
- [ ] 可以產生 QR Code
- [ ] 可以下載 QR Code
- [ ] 簽到頁面可以正常開啟
- [ ] 管理後台可以正常開啟

### 簽到功能測試
- [ ] 輸入正確的序號可以簽到
- [ ] 輸入正確的姓名可以簽到
- [ ] 重複簽到會顯示錯誤訊息
- [ ] 輸入不存在的序號/姓名會顯示錯誤訊息
- [ ] 簽到後 Google Sheet 有正確更新

### 管理後台測試
- [ ] 可以用密碼登入
- [ ] 統計數字正確顯示
- [ ] 全部名單可以正常顯示
- [ ] 已簽到名單可以正常顯示
- [ ] 未簽到名單可以正常顯示
- [ ] 搜尋功能正常運作
- [ ] 可以匯出 CSV
- [ ] 重新整理功能正常

### 行動裝置測試
- [ ] 手機瀏覽器可以正常開啟
- [ ] 手機可以掃描 QR Code
- [ ] 手機上簽到功能正常
- [ ] 手機上管理後台可以正常使用
- [ ] 平板上顯示正常

### 效能測試
- [ ] 頁面載入速度正常（< 3 秒）
- [ ] 簽到回應速度正常（< 2 秒）
- [ ] 管理後台資料載入正常（< 3 秒）
- [ ] 多人同時簽到不會出錯

## 上線前最終檢查

### 安全性
- [ ] 管理員密碼夠強（至少 8 位，包含英數字）
- [ ] 環境變數沒有外洩
- [ ] `.env` 檔案沒有被推送到 GitHub
- [ ] 服務帳號權限設定正確（只有必要的 Sheet 權限）

### 資料準備
- [ ] 所有參加者資料已輸入完成
- [ ] 序號沒有重複
- [ ] 姓名拼寫正確
- [ ] 已清空測試資料的簽到記錄

### 文件準備
- [ ] 已準備工作人員操作手冊
- [ ] 已列印 QR Code
- [ ] 已準備備用方案（如果系統故障）
- [ ] 已通知參加者簽到方式

### 備份
- [ ] 已備份 Google Sheet
- [ ] 已記錄所有重要資訊（Sheet ID、密碼等）
- [ ] 已儲存 QR Code 圖檔

## 活動當天檢查

### 開始前（提前 1 小時）
- [ ] 確認網站可以正常訪問
- [ ] 確認 QR Code 可以正常掃描
- [ ] 測試簽到功能
- [ ] 確認管理後台可以登入
- [ ] 準備好工作人員的裝置（平板/筆電）

### 進行中
- [ ] 定期檢查簽到狀況
- [ ] 注意是否有異常（重複簽到、系統錯誤等）
- [ ] 協助無法自行簽到的參加者
- [ ] 記錄特殊狀況

### 結束後
- [ ] 匯出最終簽到報表
- [ ] 備份 Google Sheet
- [ ] 統計簽到率
- [ ] 整理未簽到名單
- [ ] 產生活動報告

## 常見問題處理

### 部署失敗
1. 檢查建置日誌找出錯誤原因
2. 確認所有環境變數都已設定
3. 確認 `GOOGLE_PRIVATE_KEY` 格式正確
4. 嘗試重新部署

### 無法連接 Google Sheets
1. 檢查服務帳號權限
2. 確認 Sheet ID 正確
3. 確認環境變數設定正確
4. 檢查 Google Cloud API 配額

### 簽到功能異常
1. 檢查 Google Sheet 格式
2. 確認標題列正確
3. 確認資料從第二列開始
4. 檢查序號/姓名是否有特殊字元

### 管理後台無法登入
1. 確認密碼設定正確
2. 確認 `NEXT_PUBLIC_ADMIN_PASSWORD` 已設定
3. 清除瀏覽器快取
4. 嘗試無痕模式

## 緊急聯絡資訊

記錄以下資訊以備不時之需：

- **Vercel 專案網址**：_________________
- **Google Sheet 網址**：_________________
- **Sheet ID**：_________________
- **管理員密碼**：_________________
- **服務帳號 Email**：_________________
- **技術支援聯絡人**：_________________
- **備用方案**：_________________

## 部署完成確認

- [ ] 所有測試項目都已通過
- [ ] 所有文件都已準備完成
- [ ] 工作人員已完成培訓
- [ ] 備份和緊急方案已準備
- [ ] 系統已準備好上線使用

---

**部署日期**：_______________  
**部署人員**：_______________  
**檢查人員**：_______________  
**簽名**：_______________

---

**專案**: EasyCheck - 活動點名系統  
**版本**: 1.0.0  
**授權**: MIT License  
**建立日期**: 2024/11/28
