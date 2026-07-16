# Design QA：簡化註冊頁

## 比對來源

- 原始畫面：本次對話附件 `signup-before-marketing-layout`。
- 目標畫面：本次對話附件 `signup-reference-step-1`、`signup-reference-step-2`。
- 實作畫面：
  - `docs/assets/design-qa/signup-simplified-desktop.png`
  - `docs/assets/design-qa/signup-simplified-mobile.png`

## 驗證結果

- 版面：移除行銷頁標題、右側四步驟與下方說明卡，改為置中的單一卡片；主要註冊操作無需捲動即可看到。
- 視覺：沿用登入頁既有的品牌標誌、字級、色彩、圓角、邊框與陰影，沒有新增另一套設計語言。
- 內容：卡片只保留建立帳號、Google／驗證碼註冊、返回登入與收合的專人協助入口。
- 響應式：桌面與 390 × 844 手機尺寸均無重疊、裁切或異常換行；按鈕和連結仍可操作。
- 互動：專人協助表單預設收合，點擊摘要可正常展開並再次收合。
- 可及性：頁面保留單一 `h1`、表單標籤、語意化 `details`／`summary` 與鍵盤可操作連結。
- 瀏覽器訊息：沒有應用程式錯誤；僅看到 Next.js 開發模式的 HMR 警告，不影響註冊頁功能。
- 驗證碼狀態：受既有 feature flags、CAPTCHA 與 provider 設定保護；本次未變更開關或外部設定，兩步流程由既有 UI 回歸測試覆蓋。

final result: passed
