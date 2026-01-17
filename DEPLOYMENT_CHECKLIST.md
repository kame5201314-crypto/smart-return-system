# Smart Return System - 部署檢查清單

## Supabase 專案資訊

| 項目 | 值 |
|------|-----|
| Project ID | `fdzfnenizyppxglypden` |
| Project Name | smart-return-system |
| Region | Northeast Asia (Tokyo) |
| Dashboard | https://supabase.com/dashboard/project/fdzfnenizyppxglypden |

## Vercel 專案資訊

| 項目 | 值 |
|------|-----|
| Project Name | smart-return-system |
| Production URL | https://smart-return-system.vercel.app |
| Dashboard | https://vercel.com/dashboard |

---

## 部署前檢查清單

### 1. 環境變數確認

- [ ] `NEXT_PUBLIC_SUPABASE_URL` 包含 `fdzfnenizyppxglypden`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已設定
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 已設定
- [ ] `GEMINI_API_KEY` 已設定 (AI 分析功能需要)

### 2. 資料庫遷移確認

- [ ] `003_shopee_returns.sql` 已執行 (蝦皮退貨表)
- [ ] `004_portal_and_ai_tables.sql` 已執行 (Portal 與 AI 分析表)

### 3. Storage Bucket 確認

- [ ] `return-images` bucket 已建立
- [ ] `return-images` bucket 設為 Public

### 4. 驗證指令

```bash
# 本地驗證環境變數
npm run verify-env

# 或使用簡易檢查
npm run prebuild:check
```

---

## 環境變數範本

```env
# Supabase - smart-return-system (fdzfnenizyppxglypden)
NEXT_PUBLIC_SUPABASE_URL=https://fdzfnenizyppxglypden.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI Analysis
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 常見問題排除

### Q: Portal 提交失敗 "送出失敗"
**A:** 資料庫表格尚未建立，請執行 `004_portal_and_ai_tables.sql`

### Q: AI 分析顯示 "退貨資料表尚未建立"
**A:** 資料庫表格尚未建立，請執行 `004_portal_and_ai_tables.sql`

### Q: 圖片上傳失敗
**A:** 確認 `return-images` Storage bucket 已建立並設為 Public

### Q: 資料寫入錯誤的資料庫
**A:** 檢查 `NEXT_PUBLIC_SUPABASE_URL` 是否包含正確的 project ID `fdzfnenizyppxglypden`

---

## SQL 遷移檔案位置

```
supabase/migrations/
├── 003_shopee_returns.sql      # 蝦皮退貨管理
└── 004_portal_and_ai_tables.sql # Portal + AI 分析
```

## 聯絡資訊

如有問題請檢查：
1. Supabase Dashboard Logs
2. Vercel Function Logs
3. Browser Console
