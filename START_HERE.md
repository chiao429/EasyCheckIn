# 🎯 從這裡開始 - EasyCheck 活動點名系統

歡迎使用 EasyCheck！這是一個完整可部署的活動點名系統。

## 📚 文件導覽

根據你的需求，選擇適合的文件：

### 🚀 快速開始（推薦新手）
**[QUICKSTART.md](./QUICKSTART.md)** - 5 分鐘快速啟動指南
- 最快的方式開始使用
- 包含基本測試流程
- 適合第一次使用

### 📖 完整設定指南
**[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - 詳細的設定步驟
- Google Cloud 專案設定
- Google Sheets API 設定
- 環境變數配置
- Vercel 部署教學
- 疑難排解

### 📋 專案說明
**[README.md](./README.md)** - 專案概述和功能介紹
- 功能特色
- 技術架構
- 使用方式
- 常見問題

### 📊 Google Sheet 範本
**[GOOGLE_SHEET_TEMPLATE.md](./GOOGLE_SHEET_TEMPLATE.md)** - 資料表格式說明
- 標準範本格式
- 範例資料
- 進階設定
- 資料維護技巧

### ✅ 部署檢查清單
**[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - 上線前檢查
- 部署前準備
- 測試項目
- 上線檢查
- 活動當天流程

### 🏗️ 系統架構
**[ARCHITECTURE.md](./ARCHITECTURE.md)** - 技術架構說明
- 系統架構圖
- 資料流程圖
- 元件架構
- 擴展性設計

### 📝 專案總結
**[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - 完整專案資訊
- 核心功能
- API 文件
- 安全性設計
- 未來規劃

## 🎬 快速開始三步驟

### 1️⃣ 安裝依賴
```bash
npm install
```

### 2️⃣ 設定環境變數
```bash
cp .env.example .env
# 編輯 .env 填入你的設定
```

### 3️⃣ 啟動開發伺服器
```bash
npm run dev
```

開啟 http://localhost:3000 開始使用！

## 📂 專案結構

```
EasyCheck/
├── 📄 START_HERE.md              ← 你在這裡！
├── 📄 QUICKSTART.md              ← 快速開始
├── 📄 SETUP_GUIDE.md             ← 完整設定
├── 📄 README.md                  ← 專案說明
├── 📄 DEPLOYMENT_CHECKLIST.md    ← 部署清單
├── 📄 GOOGLE_SHEET_TEMPLATE.md   ← Sheet 範本
├── 📄 ARCHITECTURE.md            ← 系統架構
├── 📄 PROJECT_SUMMARY.md         ← 專案總結
│
├── 📁 app/                       ← Next.js 應用程式
│   ├── 📁 api/                   ← API Routes
│   ├── 📁 checkin/[eventId]/     ← 簽到頁面
│   ├── 📁 admin/[eventId]/       ← 管理後台
│   └── 📄 page.tsx               ← 首頁
│
├── 📁 components/                ← React 元件
│   └── 📁 ui/                    ← UI 元件庫
│
├── 📁 lib/                       ← 工具函式
│   ├── 📄 google-sheets.ts       ← Google Sheets API
│   └── 📄 utils.ts               ← 工具函式
│
└── 📄 package.json               ← 專案依賴
```

## 🎯 使用場景

### 適合你的場景？
- ✅ 中小型活動（< 1000 人）
- ✅ 需要快速部署（< 1 小時）
- ✅ 預算有限（完全免費）
- ✅ 需要即時查看簽到狀況
- ✅ 需要匯出報表

### 核心功能
- 🔲 單一 QR Code 簽到
- 📊 即時統計儀表板
- 🔍 搜尋與篩選功能
- 📥 CSV 報表匯出
- 📱 響應式設計（手機/平板/電腦）

## 🛠️ 技術棧

- **前端**: Next.js 14 + TypeScript + TailwindCSS
- **後端**: Next.js API Routes
- **資料庫**: Google Sheets API
- **部署**: Vercel
- **UI**: shadcn/ui + Lucide Icons

## 📖 學習路徑

### 第一次使用？
1. 閱讀 **[QUICKSTART.md](./QUICKSTART.md)** （5 分鐘）
2. 跟著步驟設定環境
3. 測試基本功能
4. 閱讀 **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** 了解細節

### 準備部署？
1. 完成本地測試
2. 閱讀 **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)**
3. 逐項檢查清單
4. 部署到 Vercel

### 想深入了解？
1. 閱讀 **[ARCHITECTURE.md](./ARCHITECTURE.md)** 了解架構
2. 閱讀 **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** 了解全貌
3. 查看程式碼註解
4. 自訂功能

## 🆘 需要幫助？

### 常見問題
查看各文件的「常見問題」章節：
- [README.md - 常見問題](./README.md#常見問題)
- [SETUP_GUIDE.md - 疑難排解](./SETUP_GUIDE.md#疑難排解)
- [QUICKSTART.md - 快速解決](./QUICKSTART.md#常見問題快速解決)

### 問題排查順序
1. 檢查環境變數是否正確設定
2. 確認 Google Sheets 權限設定
3. 查看瀏覽器開發者工具的錯誤訊息
4. 查看 Vercel 部署日誌
5. 參考文件中的疑難排解章節

### 取得支援
- 📧 開 GitHub Issue
- 💬 查看專案文件
- 🔍 搜尋相關錯誤訊息

## ⚡ 快速指令

```bash
# 安裝依賴
npm install

# 開發模式
npm run dev

# 建置專案
npm run build

# 啟動生產伺服器
npm start

# 程式碼檢查
npm run lint
```

## 🎨 自訂設定

### 修改樣式
編輯 `app/globals.css` 中的 CSS 變數

### 修改功能
- API 邏輯：`app/api/*/route.ts`
- Google Sheets：`lib/google-sheets.ts`
- UI 元件：`components/ui/*.tsx`

### 新增功能
參考現有程式碼結構，保持一致性

## 📊 專案狀態

- ✅ 核心功能完成
- ✅ 文件完整
- ✅ 可立即部署
- ✅ 生產環境就緒

## 🚀 下一步

選擇你的路徑：

### 路徑 A：快速測試（30 分鐘）
1. 閱讀 [QUICKSTART.md](./QUICKSTART.md)
2. 設定環境變數
3. 啟動開發伺服器
4. 測試基本功能

### 路徑 B：完整設定（1-2 小時）
1. 閱讀 [SETUP_GUIDE.md](./SETUP_GUIDE.md)
2. 設定 Google Cloud
3. 準備 Google Sheet
4. 完整測試
5. 部署到 Vercel

### 路徑 C：深入研究（3+ 小時）
1. 閱讀所有文件
2. 理解系統架構
3. 自訂功能
4. 擴展系統

## 💡 小提示

- 💾 記得備份 `.env` 檔案（但不要提交到 Git）
- 🔑 使用強密碼保護管理後台
- 📋 活動前先測試完整流程
- 🔄 定期備份 Google Sheet
- 📱 測試不同裝置的顯示效果

## 🎉 準備好了嗎？

選擇一個文件開始吧！

**推薦起點**：[QUICKSTART.md](./QUICKSTART.md) 👈 從這裡開始！

---

**專案**: EasyCheck - 活動點名系統  
**版本**: 1.0.0  
**授權**: MIT License  
**建立日期**: 2024/11/28

祝你使用愉快！🎊
