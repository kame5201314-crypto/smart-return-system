# AI Visual QC Automator

視覺品管自動化系統 - Operations Hub 雙核心架構

## 專案概述

自動化檢查外包上傳的圖影檔案，利用 AI 揪出錯字、規格錯誤，並自動生成標註與備註文字，節省 80% 審核時間。

## 技術架構

### 前端 (Frontend)
- **框架**: Next.js 15 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **部署**: Vercel

### 後端 (Backend)
- **框架**: Python FastAPI
- **AI**: OpenAI GPT-4o Vision + Whisper
- **部署**: Docker (Railway / Render / AWS)

### 資料庫 (Database)
- **服務**: Supabase
- **Schema 架構**:
  - `public` - 共用 (organizations, users)
  - `outsourcing_qc` - 外包審核
  - `infringement_system` - 侵權監控
  - `ops_metrics` - 營運儀表板

## 快速開始

### 1. 前端開發

```bash
cd frontend
cp .env.local.example .env.local
# 編輯 .env.local 填入 Supabase 憑證
npm install
npm run dev
```

### 2. 後端開發

```bash
cd backend
cp .env.example .env
# 編輯 .env 填入所有 API 金鑰
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 3. Docker 開發環境

```bash
# 在專案根目錄
cp .env.example .env
docker-compose up -d
```

## 資料庫設定

1. 建立 Supabase 專案
2. 到 SQL Editor 執行以下遷移檔案：
   - `supabase/migrations/001_create_schemas.sql`
   - `supabase/migrations/002_infringement_and_metrics.sql`
   - `supabase/migrations/003_rls_policies.sql`

## 核心功能

### A. 雲端同步與監控
- 連結 Google Drive 資料夾
- 定時掃描新檔案
- 支援 JPG/PNG/WebP/GIF 圖片與 MP4/WebM 影片

### B. AI 智能檢查引擎
- 圖片 OCR 糾錯
- 產品規格比對
- 禁用詞彙檢測
- 品牌規範檢查
- AI 創意建議

### C. 雙屏審核界面
- 左側：原始圖片/影片預覽
- 右側：AI 檢查報告
- 互動標註與確認

### D. 一鍵反饋生成
- 產出專屬 URL 網頁
- 包含錯誤標記與備註
- 外包商可直接對照修改

## 環境變數

### 前端 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 後端 (.env)
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
API_SECRET_KEY=
```

## API 文件

啟動後端服務後，訪問：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 資安注意事項

- 所有 API Key 必須存放於 .env 檔案
- .env 檔案已加入 .gitignore
- 前端僅顯示通用錯誤訊息
- 所有資料表啟用 RLS，依 org_id 隔離

## 授權

私有專案 - 保留所有權利
