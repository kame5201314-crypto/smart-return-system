# Signup Design QA

- Source visual truth: user-provided third attached image in the 2026-07-17 request
  (conversation attachment; no filesystem path exposed to the workspace)
- Implementation screenshot: `C:\Users\kawei\AppData\Local\Temp\smart-return-signup-qa\signup-desktop.png`
- Mobile screenshot: `C:\Users\kawei\AppData\Local\Temp\smart-return-signup-qa\signup-mobile-390x844.png`
- Viewports: Chrome default desktop viewport and 390 × 844 mobile viewport
- State: first registration step, before OTP delivery

## Full-view comparison evidence

- The implementation follows the selected reference's single vertical form:
  `手機／信箱`、`密碼`、`確認密碼`、`推薦碼`、existing-account link、terms checkbox、
  and one full-width `註冊` button.
- The Beta introduction, amber provider-readiness panel, manual application form,
  support disclosure, and Google registration option are absent.
- The existing Smart Return logo, product title, card shell, legal routes, and home
  navigation remain as the surrounding product design system.
- Desktop alignment, input widths, label hierarchy, icon placement, border treatment,
  and vertical rhythm match the reference's clean account-creation direction.
- At 390 × 844 the page has no horizontal overflow: viewport width, document width,
  and body width all equal 390 px.

## Focused region comparison evidence

A separate focused crop was not needed because every form label, input, icon, checkbox,
legal link, and primary button is clearly readable in the full-page desktop and mobile
captures.

## Required fidelity surfaces

- Fonts and typography: existing Smart Return font stack retained; heading, label, helper,
  and action hierarchy match the reference.
- Spacing and layout rhythm: one-column layout, consistent field gaps, generous card
  padding, and full-width primary action pass at desktop and mobile widths.
- Colors and visual tokens: neutral fields and black primary action use the existing
  product tokens; no readiness-warning color remains.
- Image quality and asset fidelity: the screen contains no custom raster artwork; the
  existing product logo and Lucide field icons remain sharp at both viewports.
- Copy and content: visible content is limited to the requested registration flow plus
  existing product navigation and legal links.

## Primary interactions tested

- Entered a synthetic Email, password, confirmation, and referral code.
- Checked the terms control through its visible label.
- Confirmed the registration button becomes actionable.
- Confirmed a closed runtime channel reports one inline error without restoring rollout
  notices or calling the provider.
- Provider-ready Email/Phone → OTP → verified session → signup completion remains covered
  by automated UI and backend contract tests.
- Browser console errors: none.

## Findings

No actionable P0, P1, or P2 visual mismatch remains.

## Comparison history

- Initial comparison: passed. No P0/P1/P2 fix iteration was required after the rendered
  desktop and mobile captures.

## Follow-up polish

- P3: the reference is a tight crop of the form, while the implementation intentionally
  retains the existing Smart Return brand header, card, home link, and copyright footer.

final result: passed

---

# Billing Design QA — 帳務與訂閱頁

## Source of truth

- 使用者於本對話提供的 `/settings/billing` 桌面版截圖。
- 本次需求：隱藏租戶／QA 名稱、試用帳戶統一顯示「試用版」、移除帳務流程的聯絡客服入口，並聚焦現有入門版／成長版預付付款功能。

## Intentional changes

- 內容寬度收斂為 `max-w-5xl`，避免大型螢幕卡片過寬及右側空白失衡。
- 「目前方案」只顯示方案、狀態與日期，不再顯示組織名稱。
- 試用中與由試用到期造成的停用皆顯示「試用版」；付費方案停權仍顯示原方案，避免誤標。
- 移除企業客製方案與聯絡客服 CTA；頁面只保留可實際自助付款的入門版、成長版。
- 付款紀錄桌面使用表格，手機改為卡片，避免橫向捲動。

## Desktop QA

- Viewport：`1440 × 1000`
- Screenshot：`C:/Users/kawei/AppData/Local/Temp/smart-return-billing-qa/billing-settings-desktop.png`
- 結果：方案摘要、日期、雙方案選擇與付款紀錄層級清楚；沒有顯示 QA 組織名稱或客服 CTA。

## Mobile QA

- Viewport：`390 × 844`
- Screenshot：`C:/Users/kawei/AppData/Local/Temp/smart-return-billing-qa/billing-settings-mobile.png`
- History screenshot：`C:/Users/kawei/AppData/Local/Temp/smart-return-billing-qa/billing-settings-mobile-history.png`
- 結果：`scrollWidth 375 <= viewportWidth 390`，無橫向溢位；方案與付款紀錄維持單欄可讀。

## Functional and console QA

- 頁面包含「試用版」、「試用已到期」與「選擇方案」。
- 頁面不包含 `Google QA Trial 20260715 1726` 或「聯絡客服」。
- 入門版與成長版付款按鈕可用；未觸發真實付款。
- Browser errors/warnings：0。

## Result

Pass.
