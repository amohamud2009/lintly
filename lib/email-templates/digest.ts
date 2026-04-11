interface DigestData {
  userName: string;
  reviewsYesterday: number;
  avgScore: number | null;
  avgScorePrev: number | null;
  securityScansRun: number;
  securityIssuesFound: number;
  topIssueTypes: { type: string; count: number }[];
  weeklyIssuesCaught: number;
  unsubscribeUrl: string;
}

export function buildDigestHtml(data: DigestData): string {
  const scoreColor = data.avgScore === null
    ? "#525252"
    : data.avgScore >= 80
      ? "#34d399"
      : data.avgScore >= 50
        ? "#fbbf24"
        : "#f87171";

  const scoreDelta = data.avgScore !== null && data.avgScorePrev !== null
    ? data.avgScore - data.avgScorePrev
    : null;

  const deltaText = scoreDelta !== null
    ? scoreDelta > 0
      ? `<span style="color:#34d399;">↑ ${scoreDelta}</span>`
      : scoreDelta < 0
        ? `<span style="color:#f87171;">↓ ${Math.abs(scoreDelta)}</span>`
        : `<span style="color:#525252;">—</span>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.08);line-height:36px;text-align:center;color:rgba(255,255,255,0.8);font-size:14px;font-weight:700;">L</div>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:8px 0 0;">Daily Health Digest</p>
    </div>

    <h1 style="color:#e5e5e5;font-size:22px;font-weight:600;margin:0 0 24px;text-align:center;">
      Good morning, ${data.userName}
    </h1>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:rgba(255,255,255,0.4);font-size:13px;">PRs reviewed</td>
          <td style="padding:8px 0;color:#e5e5e5;font-size:20px;font-weight:600;text-align:right;">${data.reviewsYesterday}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:rgba(255,255,255,0.4);font-size:13px;">Avg score ${deltaText}</td>
          <td style="padding:8px 0;color:${scoreColor};font-size:20px;font-weight:600;text-align:right;">${data.avgScore ?? "—"}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:rgba(255,255,255,0.4);font-size:13px;">Security scans</td>
          <td style="padding:8px 0;color:#e5e5e5;font-size:20px;font-weight:600;text-align:right;">${data.securityScansRun}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:rgba(255,255,255,0.4);font-size:13px;">Issues found</td>
          <td style="padding:8px 0;color:${data.securityIssuesFound > 0 ? "#f87171" : "#34d399"};font-size:20px;font-weight:600;text-align:right;">${data.securityIssuesFound}</td>
        </tr>
      </table>
    </div>

    ${data.topIssueTypes.length > 0 ? `
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;margin-bottom:16px;">
      <p style="color:rgba(255,255,255,0.3);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Top issue types</p>
      ${data.topIssueTypes.map((t) => `<div style="display:flex;justify-content:space-between;padding:6px 0;"><span style="color:rgba(255,255,255,0.6);font-size:14px;">${t.type}</span><span style="color:rgba(255,255,255,0.3);font-size:13px;">${t.count}×</span></div>`).join("")}
    </div>` : ""}

    <div style="background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.12);border-radius:16px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="color:#34d399;font-size:14px;margin:0;">
        Lintly has caught <strong>${data.weeklyIssuesCaught}</strong> issues in your codebase this week
      </p>
    </div>

    <div style="text-align:center;margin-top:32px;">
      <a href="${data.unsubscribeUrl}" style="color:rgba(255,255,255,0.2);font-size:11px;text-decoration:underline;">Unsubscribe from digests</a>
    </div>
  </div>
</body>
</html>`;
}
