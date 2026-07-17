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
