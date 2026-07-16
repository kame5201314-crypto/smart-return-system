# Design QA

## 簡化註冊頁（commit `71c3ac1`）

### 比對來源

- 原始畫面：本次對話附件 `signup-before-marketing-layout`。
- 目標畫面：本次對話附件 `signup-reference-step-1`、`signup-reference-step-2`。
- 實作畫面：
  - `docs/assets/design-qa/signup-simplified-desktop.png`（1628 × 842）
  - `docs/assets/design-qa/signup-simplified-mobile.png`（375 × 812）

### 驗證結果

- 版面：移除行銷頁標題、右側四步驟與下方說明卡，改為置中的單一卡片。
- 視覺：沿用登入頁既有標誌、字級、色彩、圓角、邊框與陰影。
- 內容：只保留建立帳號、Google／驗證碼註冊、返回登入與收合的專人協助入口。
- 響應式與互動：桌面和手機均無重疊或裁切；專人協助表單可正常展開與收合。
- 可及性：保留單一 `h1`、表單標籤、語意化 `details`／`summary` 與鍵盤操作。

Result: passed

## 登入頁重新排版

### 比對來源與狀態

- Source visual truth：本次對話附件 `login-before-reorder-with-google-top`，使用者指定帳密登入在上、Google 登入在下並加入 Google 圖案。
- Implementation：`http://localhost:3001/login`。
- 桌面證據：`docs/assets/design-qa/login/login-merchant-reference-825x1200.png`（瀏覽器要求 840 × 1222；實際頁面截圖 825 × 1200）。
- 手機證據：`docs/assets/design-qa/login/login-merchant-mobile-375x812.png`（瀏覽器要求 390 × 844；實際頁面截圖 375 × 812）。
- 商家狀態：Google Auth 開啟、帳密登入可用、註冊入口可見。
- 管理員狀態：`/login?next=%2Finternal`，Google 主登入與商家註冊入口均隱藏。
- 截圖中的右側浮動圖示及左下角開發工具按鈕由本機瀏覽器擴充套件／開發模式產生，不屬於產品 UI。

### Full-view comparison

- 資訊順序：帳號、密碼與黑色登入按鈕位於卡片主要區域；Google 分隔線與按鈕緊接其後；註冊入口維持最下方，符合指定層級。
- Spacing／layout rhythm：沿用既有 `max-w-md`、卡片 padding、欄位間距、圓角與陰影；桌面與手機均無水平 overflow、重疊或主要操作裁切。
- Fonts／typography：沿用既有字體、標題粗細和表單文字比例；新分隔文案維持次要層級，沒有壓過帳密登入。
- Colors／tokens：保留黑色主要登入按鈕、白底次要 Google 按鈕和中性色分隔線；對比與原登入頁一致。
- Copy／content：說明文案同步改為帳密優先，Google 作為第二種登入方式；未改動 OAuth 目的地或方案參數。

### Focused-region comparison

- 已放大檢查 Google 按鈕：使用 Google 官方 Sign in with Google 資產包中的彩色 G 圖案，保持比例、顏色、白底與清晰度；沒有自製 SVG、CSS 圖案或單色替代。
- 圖案設為裝飾性空白替代文字，連結可存取名稱仍為「使用 Google 登入」。
- OAuth 失效重試入口使用相同品牌圖案；一般 Google 入口仍保留安全的 `next`／`plan` 組合。

### Interactions and accessibility

- 密碼顯示／隱藏切換已實際操作，輸入型態可在 `password` 與 `text` 間正確切換。
- Google 連結仍指向 `/auth/google?next=%2Fanalytics`，未觸發真實 OAuth 流程。
- 平台管理員頁面沒有商家 Google 登入或註冊入口。
- 瀏覽器 console 無 error 或 warning。

### Findings and comparison history

- Pass 1：未發現可執行的 P0／P1／P2 差異；本輪沒有因 QA 再修改視覺。
- P3 follow-up：本機瀏覽器擴充套件會出現在截圖上，但不會出現在正式產品頁面，無需修改應用程式。

final result: passed
