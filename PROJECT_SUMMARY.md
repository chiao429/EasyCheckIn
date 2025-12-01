# EasyCheck 專案總結

## 專案概述

**EasyCheck** 是一個現代化的活動點名系統，使用單一 QR Code 讓所有參加者進行簽到。系統整合 Google Sheets API 作為資料庫，部署在 Vercel 平台上，提供快速、穩定、易用的簽到體驗。

## 核心功能

### 1. 簽到系統
- 單一 QR Code 入口
- 支援序號或姓名簽到
- 自動記錄簽到時間
- 防止重複簽到
- 即時回饋簽到結果

### 2. 管理後台
- 密碼保護
- 即時統計（總人數、已簽到、未簽到）
- 四種查詢模式：
  - 全部名單
  - 已簽到名單
  - 未簽到名單
  - 搜尋功能
- CSV 報表匯出
- 響應式設計

### 3. QR Code 產生器
- 自訂活動 ID
- 即時產生 QR Code
- 下載功能
- 顯示簽到和管理連結

## 技術架構

### 前端技術
- **框架**: Next.js 14 (App Router)
- **語言**: TypeScript
- **樣式**: TailwindCSS
- **UI 元件**: shadcn/ui
- **圖示**: Lucide React
- **QR Code**: qrcode 套件

### 後端技術
- **API**: Next.js API Routes
- **資料庫**: Google Sheets API
- **認證**: Google Service Account

### 部署平台
- **主機**: Vercel
- **CI/CD**: GitHub + Vercel 自動部署
- **環境變數**: Vercel Environment Variables

## 專案結構

```
EasyCheck/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── checkin/route.ts      # 簽到 API
│   │   ├── attendees/route.ts    # 查詢參加者 API
│   │   └── search/route.ts       # 搜尋 API
│   ├── checkin/[eventId]/        # 簽到頁面
│   │   └── page.tsx
│   ├── admin/[eventId]/          # 管理後台
│   │   └── page.tsx
│   ├── globals.css               # 全域樣式
│   ├── layout.tsx                # 根佈局
│   └── page.tsx                  # 首頁（QR Code 產生器）
├── components/                   # React 元件
│   └── ui/                       # UI 元件庫
│       ├── button.tsx
│       ├── input.tsx
│       └── card.tsx
├── lib/                          # 工具函式庫
│   ├── google-sheets.ts          # Google Sheets API 整合
│   └── utils.ts                  # 通用工具函式
├── .env.example                  # 環境變數範例
├── .gitignore                    # Git 忽略檔案
├── package.json                  # 專案依賴
├── tsconfig.json                 # TypeScript 設定
├── tailwind.config.ts            # Tailwind 設定
├── next.config.js                # Next.js 設定
├── vercel.json                   # Vercel 部署設定
├── README.md                     # 專案說明
├── SETUP_GUIDE.md                # 完整設定指南
├── QUICKSTART.md                 # 快速開始指南
├── GOOGLE_SHEET_TEMPLATE.md      # Google Sheet 範本說明
├── DEPLOYMENT_CHECKLIST.md       # 部署檢查清單
└── PROJECT_SUMMARY.md            # 專案總結（本檔案）
```

## API 端點

### POST /api/checkin
簽到功能

**請求**：
```json
{
  "identifier": "001",
  "sheetId": "1ABC...XYZ"
}
```

**回應**：
```json
{
  "success": true,
  "message": "簽到成功！",
  "data": {
    "序號": "001",
    "姓名": "王小明",
    "到達時間": "2024/11/28 15:30:45",
    "已到": "TRUE"
  }
}
```

### GET /api/attendees
查詢參加者名單

**參數**：
- `sheetId`: Sheet ID
- `filter`: all | checked | unchecked

**回應**：
```json
{
  "success": true,
  "data": [...],
  "total": 100
}
```

### GET /api/search
搜尋參加者

**參數**：
- `sheetId`: Sheet ID
- `query`: 搜尋關鍵字（可輸入序號或姓名的一部分）

**回應**：
```json
{
  "success": true,
  "data": [...],
  "count": 5
}
```

### POST /api/admin/login
管理後台登入驗證

**請求**：
```json
{
  "password": "後台密碼"
}
```

**回應（成功）**：
```json
{
  "success": true
}
```

**回應（失敗）**：
```json
{
  "success": false,
  "message": "密碼錯誤"
}
```

### POST /api/manager/cancel-checkin
管理員取消簽到（將某筆資料恢復為「未簽到」狀態）

**請求**：
```json
{
  "sheetId": "1ABC...XYZ",
  "identifier": "001" // 序號或姓名
}
```

### POST /api/manager/mark-cancelled
管理員將參加者標記為「不會來」

**請求**：
```json
{
  "sheetId": "1ABC...XYZ",
  "identifier": "001" // 序號或姓名
}
```

## 資料流程

### 簽到流程
```
1. 使用者掃描 QR Code
   ↓
2. 進入簽到頁面 (/checkin/[eventId])
   ↓
3. 輸入序號或姓名
   ↓
4. 前端發送 POST 請求到 /api/checkin
   ↓
5. 後端查詢 Google Sheets
   ↓
6. 驗證資料並更新簽到狀態
   ↓
7. 回傳結果給前端
   ↓
8. 顯示成功或失敗訊息
```

### 管理查詢流程
```
1. 管理員訪問 /admin/[eventId]
   ↓
2. 輸入密碼驗證
   ↓
3. 前端發送 GET 請求到 /api/attendees
   ↓
4. 後端從 Google Sheets 讀取資料
   ↓
5. 根據篩選條件處理資料
   ↓
6. 回傳資料給前端
   ↓
7. 顯示統計和名單
```

## 環境變數說明

### 伺服器端變數（不公開）
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Google Service Account email
- `GOOGLE_PRIVATE_KEY`: Google Service Account 私鑰
- `GOOGLE_EVENT_CONFIG_SHEET_ID`: 活動設定試算表的 Sheet ID（存放活動清單與後台密碼）

### 客戶端變數（公開）
- `NEXT_PUBLIC_BASE_URL`: 網站基礎網址

## 安全性設計

### 1. 認證機制
- 管理後台使用密碼保護
- 密碼儲存在環境變數中
- 前端簡單驗證（可升級為 JWT）

### 2. API 安全
- Google Sheets API 使用服務帳號認證
- 私鑰儲存在伺服器端環境變數
- 不暴露敏感資訊給客戶端

### 3. 資料保護
- 使用 HTTPS 加密傳輸
- 環境變數不提交到 Git
- 服務帳號權限最小化

### 4. 輸入驗證
- 前端驗證使用者輸入
- 後端驗證 API 請求參數
- 防止 SQL Injection（使用 Google Sheets API）

## 效能優化

### 1. 前端優化
- Next.js 自動程式碼分割
- 圖片和字體優化
- CSS 最小化
- 響應式圖片載入

### 2. API 優化
- 使用 Next.js API Routes（Edge Functions）
- 減少不必要的資料傳輸
- 快取策略（可選）

### 3. 部署優化
- Vercel Edge Network（全球 CDN）
- 自動 HTTPS
- 自動擴展

## 使用場景

### 適合的場景
- ✅ 中小型活動（< 1000 人）
- ✅ 需要快速部署
- ✅ 預算有限
- ✅ 需要即時查看簽到狀況
- ✅ 需要匯出報表
- ✅ 多人同時簽到

### 不適合的場景
- ❌ 超大型活動（> 10000 人）
- ❌ 需要複雜的權限管理
- ❌ 需要離線功能
- ❌ 需要高度客製化

## 未來擴展方向

### 短期（1-3 個月）
- [ ] 新增多語言支援
- [ ] 改善管理後台 UI
- [ ] 新增簽到統計圖表
- [ ] 支援多個 Sheet 工作表
- [ ] 新增簽到通知功能

### 中期（3-6 個月）
- [ ] 實作 JWT 認證
- [ ] 新增使用者角色管理
- [ ] 支援自訂欄位
- [ ] 新增簽到照片功能
- [ ] 實作即時推播

### 長期（6-12 個月）
- [ ] 改用專業資料庫（PostgreSQL）
- [ ] 開發行動 App
- [ ] 新增離線簽到功能
- [ ] 實作進階分析功能
- [ ] 支援多活動管理

## 已知限制

### 技術限制
1. **Google Sheets API 配額**
   - 每分鐘 60 次讀取請求
   - 每分鐘 60 次寫入請求
   - 適合中小型活動

2. **並發處理**
   - 同時大量簽到可能會有延遲
   - 建議分批進場

3. **資料量限制**
   - 單一 Sheet 建議不超過 10,000 筆
   - 超過可能影響效能

### 功能限制
1. 簡單的密碼認證（無 JWT）
2. 無離線功能
3. 無即時推播
4. 無照片上傳
5. 無複雜的權限管理

## 成本分析

### 免費方案
- **Vercel**: 免費方案足夠使用
  - 100 GB 頻寬/月
  - 無限部署
  - 自動 HTTPS

- **Google Sheets API**: 免費
  - 每天 500,000 次請求
  - 足夠大部分活動使用

- **總成本**: $0 USD/月

### 付費升級（可選）
- **Vercel Pro**: $20 USD/月
  - 更高頻寬
  - 更多團隊成員
  - 優先支援

- **Google Cloud**: 依使用量計費
  - 超過免費配額才收費
  - 一般活動不會超過

## 維護建議

### 日常維護
- 定期檢查 Vercel 部署狀態
- 監控 Google Sheets API 使用量
- 定期備份 Google Sheet
- 更新依賴套件

### 安全維護
- 每 3-6 個月更換服務帳號金鑰
- 定期更新管理員密碼
- 檢查 GitHub 是否有敏感資訊外洩
- 監控異常登入嘗試

### 效能監控
- 使用 Vercel Analytics 監控效能
- 檢查 API 回應時間
- 監控錯誤率
- 收集使用者回饋

## 支援資源

### 文件
- `README.md` - 專案說明和快速開始
- `SETUP_GUIDE.md` - 完整設定指南
- `QUICKSTART.md` - 5 分鐘快速開始
- `GOOGLE_SHEET_TEMPLATE.md` - Google Sheet 範本說明
- `DEPLOYMENT_CHECKLIST.md` - 部署檢查清單

### 外部資源
- [Next.js 文件](https://nextjs.org/docs)
- [Google Sheets API 文件](https://developers.google.com/sheets/api)
- [Vercel 文件](https://vercel.com/docs)
- [TailwindCSS 文件](https://tailwindcss.com/docs)

### 社群支援
- GitHub Issues
- Stack Overflow
- Next.js Discord
- Vercel Community

## 授權

MIT License - 可自由使用、修改和分發

## 貢獻指南

歡迎提交 Issue 和 Pull Request！

### 貢獻流程
1. Fork 專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 致謝

感謝以下開源專案：
- Next.js
- React
- TailwindCSS
- shadcn/ui
- Google Sheets API
- Vercel

---

**專案版本**: 1.0.0  
**最後更新**: 2024/11/28  
**維護者**: EasyCheck Team
