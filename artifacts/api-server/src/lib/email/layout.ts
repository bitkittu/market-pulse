/**
 * Reusable responsive HTML layout for every MarketPulse AI transactional
 * email (§11). Deliberately plain — a wordmark, one heading, body copy, a
 * single primary CTA, an optional footer note, then the standard footer.
 * Table-based layout + inline styles because this has to survive Outlook and
 * Gmail's HTML sanitizers, not just modern browsers.
 */

const BRAND_NAME = "MarketPulse AI";
const ACCENT = "#2563eb"; // blue-600
const ACCENT_DARK = "#0f172a"; // slate-900

export interface TemplateContent {
  subject: string;
  preheader?: string | null;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  footerNote?: string | null;
}

/** Replaces every {{key}} in `template` with vars[key], leaving unknown placeholders untouched. */
export function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : match,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphsHtml(body: string): string {
  return body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

export interface FooterLinks {
  supportUrl: string;
  privacyUrl: string;
  termsUrl: string;
}

export function renderEmailHtml(content: TemplateContent, links: FooterLinks): string {
  const preheader = content.preheader ? escapeHtml(content.preheader) : "";
  const cta =
    content.ctaLabel && content.ctaUrl
      ? `<tr><td align="center" style="padding:8px 0 24px;">
           <a href="${escapeHtml(content.ctaUrl)}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">${escapeHtml(
             content.ctaLabel,
           )}</a>
         </td></tr>`
      : "";
  const footerNote = content.footerNote
    ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#64748b;">${escapeHtml(content.footerNote)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
  <tr><td style="background:${ACCENT_DARK};padding:24px 32px;">
    <span style="font-size:18px;font-weight:800;color:#ffffff;">Market<span style="color:#34d399;">Pulse</span> AI</span>
  </td></tr>
  <tr><td style="padding:32px 32px 8px;">
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(content.subject)}</h1>
    ${paragraphsHtml(content.body)}
  </td></tr>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:0 32px;">
    ${cta}
  </td></tr></table>
  <tr><td style="padding:0 32px 24px;">
    ${footerNote}
  </td></tr>
  <tr><td style="border-top:1px solid #e2e8f0;padding:20px 32px;background:#f8fafc;">
    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
      <a href="${escapeHtml(links.supportUrl)}" style="color:#64748b;text-decoration:underline;">Support</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(links.privacyUrl)}" style="color:#64748b;text-decoration:underline;">Privacy</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(links.termsUrl)}" style="color:#64748b;text-decoration:underline;">Terms</a>
    </p>
    <p style="margin:0;font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderEmailText(content: TemplateContent, links: FooterLinks): string {
  const lines = [content.body];
  if (content.ctaLabel && content.ctaUrl) {
    lines.push(`${content.ctaLabel}: ${content.ctaUrl}`);
  }
  if (content.footerNote) lines.push(content.footerNote);
  lines.push(`—\n${BRAND_NAME} · Support: ${links.supportUrl}`);
  return lines.join("\n\n");
}
