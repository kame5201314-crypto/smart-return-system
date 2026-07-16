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

## 兩步式手機／信箱註冊重設計

### 比對來源與測試狀態

- Source visual truth：本次對話附件中的既有 Google-only 註冊頁，以及指定的「手機／信箱＋密碼」第一步與「驗證碼」第二步參考畫面。
- Implementation：`http://localhost:3001/signup?plan=growth`。
- 驗收方式：最終兩步式互動使用 Chrome 在純 localhost、process-only 功能旗標及一次性假驗證回應下測試；未修改 `.env.saas.local`，假路由已於驗收後移除。
- 桌面 viewport：1216 × 1200；手機 viewport：390 × 844。
- 截圖中的右側浮動圖示及左下角開發工具按鈕由本機瀏覽器擴充套件／開發模式產生，不屬於產品 UI。

### Full-view comparison

- 第一層資訊改回使用者指定的帳號建立流程：手機號碼或電子信箱、密碼、確認密碼、推薦碼、返回登入、條款與主要「註冊」按鈕。
- Google 註冊移至帳密表單下方，使用官方 Google 品牌圖案；不再取代主要的手機／信箱驗證流程。
- 第二步只顯示目的地、唯讀推薦碼、6 位數驗證碼、倒數重送、返回上一步與主要註冊按鈕，符合參考畫面的單一任務層級。
- 沿用 Smart Return 既有黑色主操作、綠色提示、中性色邊框、圓角、陰影與字體，而不是複製參考產品的珊瑚色品牌。
- 桌面與手機均無水平 overflow、控制項重疊、文字裁切或主要操作超出卡片。

### Focused-region comparison

- 單一「手機號碼或電子信箱」欄位會自動判斷 Email 或台灣手機格式，減少參考畫面以外的額外切換元件。
- 密碼欄保留顯示／隱藏按鈕與強度說明；確認密碼、推薦碼和條款都有明確標籤及必填狀態。
- 驗證碼欄與重送按鈕在桌面並排、手機堆疊；倒數期間重送與完成註冊維持停用，避免重複請求。
- 第二步推薦碼採唯讀顯示，並提示返回上一步修改，避免讓使用者誤以為驗證碼階段的修改已回寫到第一次註冊請求。
- Turnstile 安全驗證仍保留，語系修正為支援的 `zh-tw`；正式 rollout 仍受既有 migration、provider 與 CAPTCHA readiness 旗標保護。

### Interactions and accessibility

- 已實際完成第一步送出並進入第二步，確認目的地、推薦碼、倒數重送與返回上一步狀態正確；Google 選項不會出現在驗證碼步驟。
- 手機版 390px viewport 已檢查完整頁面；驗證碼輸入自動取得焦點，重送按鈕在小螢幕保持完整寬度。
- 欄位錯誤使用 `aria-invalid`／`aria-describedby` 對應；條款 checkbox 為 required，密碼規則與輸入欄位正確關聯。
- 未操作任何真實 CAPTCHA、未寄送真實 Email／SMS，也未呼叫 Production OAuth。

### Findings and comparison history

- Pass 1：發現原頁面只有 Google 註冊，與指定的兩步式帳密流程不符；改為表單主流程並將 Google 下移。
- Pass 2：補齊手機版驗證碼按鈕堆疊、欄位錯誤關聯、條款必填、驗證碼重送防重複，以及 Turnstile 語系修正。
- Pass 3：桌面與手機完整流程比對通過；沒有剩餘 P0／P1／P2 視覺或主要互動問題。

final result: passed
