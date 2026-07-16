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

## 登入與已驗證商家 onboarding 重設計（2026-07-16）

### 比對來源與測試狀態

- Source visual truth：本次對話中使用者對登入頁資訊過多的回饋、既有 Smart Return 置中卡片設計，以及本次修改前由 Chrome 擷取的 `/login`、`/signup` 畫面。
- Implementation：`http://localhost:3001/login`、`http://localhost:3001/signup`、受登入保護的 `/signup/complete`。
- 比對方式：同一個 Chrome 工作階段、同一狀態與 viewport 並排檢查修改前後登入／註冊畫面；商家資料頁使用一次性本機 QA 路由渲染實際元件，驗收後已移除，沒有提交額外公開路由。
- 桌面 viewport：瀏覽器預設 1680 × 900；手機 viewport：390 × 844，完成後已重設回預設尺寸。
- 截圖中的右側浮動圖示及左下角開發工具按鈕由本機瀏覽器擴充套件／開發模式產生，不屬於產品 UI。

### Full-view comparison

- 登入頁由「歡迎回來＋多段說明＋大型註冊區」改為單一「登入工作區」任務：帳密為主要操作，Google 為次要登入方式，最下方只保留一個建立帳號文字入口。
- Google 仍保留官方彩色 G 圖案，但文案統一為「使用 Google 繼續」，並明示新使用者驗證後必須完成商家資料，不會直接略過 onboarding。
- 註冊入口在目前 Production-like 本機旗標下維持 Google-only，但說明已從「完成註冊」改為「驗證登入身分，接著完成商家資料」，避免誤解 Google 會自動建立完整客戶資料。
- 商家資料頁沿用既有白色卡片、綠色身分確認提示、中性色欄位與黑色主要 CTA；桌面兩欄、手機單欄，沒有新增品牌外的色彩或元件語言。
- 所有主要控制項維持至少 48px 高度；長 Email 使用可換行顯示，手機 390px 下沒有水平 overflow 或欄位重疊。

### Focused-region comparison

- 登入卡片移除重複註冊按鈕與說明後，主要登入、Google 次要操作與建立帳號入口的層級清楚，卡片高度明顯縮短。
- 平台管理員模式改用「管理員帳號或電子信箱」，且不顯示商家 Google、註冊與忘記密碼入口。
- 已驗證身分區塊顯示 Auth identity，並明示「Google 只用於確認登入身分」；後續必填品牌、聯絡人、台灣手機、平台、退貨量、聯絡偏好、方案與條款。
- Google／Email 客戶補填的手機清楚標示為尚未驗證；Phone OTP 身分的手機為唯讀並標示已驗證。
- 方案由大型卡片縮成原生下拉選單，保留價格與「3 天免費、不需信用卡、不會自動扣款」說明，降低表單視覺密度。

### Interactions and accessibility

- Chrome 實際操作密碼顯示切換，輸入型態可由 `password` 正確改成 `text`，按鈕可存取名稱同步變為「隱藏密碼」。
- 已有 session 再進入 `/login` 時會先經過 membership-aware `/signup/complete` gate；既有商家回到 analytics，尚無工作區者留在商家資料步驟。
- DOM 檢查確認 Google、建立帳號、返回登入、條款與隱私權連結均有清楚的可存取名稱及正確目的地。
- 商家資料表單的必填欄位、下拉、checkbox 與送出按鈕皆有關聯標籤；手機版保持單欄與完整 CTA。
- 未觸發真實 Google OAuth、CAPTCHA、試用建立或任何 Production API；本機 Chrome console 沒有 error。

### Findings and comparison history

- Pass 1：登入頁資訊層級重複，Google 與建立帳號都像主要 CTA；改為帳密主流程、Google 次流程與單一註冊文字入口。
- Pass 2：Google 新客戶原本只確認方案與品牌，無法取得完整聯絡資料；新增已驗證身分摘要與商家資料完成步驟，伺服器僅信任 Auth session 的 identity。
- Pass 3：補齊桌面／手機、管理員隔離、密碼切換、client payload 與後端 persistence 回歸測試；沒有剩餘 P0／P1／P2 視覺或主要互動問題。

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
