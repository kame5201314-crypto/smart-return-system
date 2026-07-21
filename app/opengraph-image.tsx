import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'AI退貨管理系統 — 台灣電商退貨管理 SaaS';

const SUBTITLE_ZH = '台灣電商退貨管理 SaaS';
const TAGLINE_ZH = '蝦皮＋官網退貨集中管理 · AI 退貨原因分析';
const SUBTITLE_EN = 'Returns Management SaaS for Taiwan E-commerce';
const TAGLINE_EN = 'Centralize Shopee + storefront returns · AI return-reason insights';

// Satori needs explicit font data for CJK glyphs. Fetch a Noto Sans TC
// subset covering only the glyphs we render; on any failure fall back to
// the English copy so the build never breaks on network issues.
async function loadChineseFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&text=${encodeURIComponent(text)}`;
    const cssResponse = await fetch(cssUrl);
    if (!cssResponse.ok) return null;
    const css = await cssResponse.text();
    const match = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
    if (!match) return null;
    const fontResponse = await fetch(match[1]);
    if (!fontResponse.ok) return null;
    return await fontResponse.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const zhText = `${SUBTITLE_ZH}${TAGLINE_ZH}`;
  const chineseFont = await loadChineseFont(zhText);
  const subtitle = chineseFont ? SUBTITLE_ZH : SUBTITLE_EN;
  const tagline = chineseFont ? TAGLINE_ZH : TAGLINE_EN;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0a0a0a',
          padding: '72px 80px',
          fontFamily: chineseFont ? 'Noto Sans TC' : 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0a0a0a',
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            SR
          </div>
          <div style={{ color: '#e5e5e5', fontSize: 30, fontWeight: 700 }}>
            AI退貨管理系統
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            {subtitle}
          </div>
          <div style={{ color: '#10b981', fontSize: 34, fontWeight: 700 }}>
            {tagline}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ color: '#a3a3a3', fontSize: 26 }}>
            app.smart-return.tw
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 24px',
              borderRadius: 999,
              border: '2px solid #10b981',
              color: '#10b981',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            3 Days Free Trial
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: chineseFont
        ? [
            {
              name: 'Noto Sans TC',
              data: chineseFont,
              weight: 700,
              style: 'normal',
            },
          ]
        : undefined,
    }
  );
}
