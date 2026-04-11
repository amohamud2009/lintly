export interface TeamReportData {
  userName: string;
  periodLabel: string;
  avgScore: number | null;
  avgScorePrev: number | null;
  totalPRs: number;
  totalIssues: number;
  mostActiveRepo: string | null;
  topCategories: { category: string; count: number }[];
  unsubscribeUrl: string;
  dashboardUrl: string;
}

export function buildTeamReportHtml(data: TeamReportData): string {
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

  const arrow = scoreDelta !== null
    ? scoreDelta > 0
      ? `<span style="color:#34d399;font-size:14px;">&uarr; ${scoreDelta} pts</span>`
      : scoreDelta < 0
        ? `<span style="color:#f87171;font-size:14px;">&darr; ${Math.abs(scoreDelta)} pts</span>`
        : `<span style="color:#525252;font-size:14px;">&mdash;</span>`
    : "";

  const categoriesHtml = data.topCategories.length > 0
    ? data.topCategories.map((c, i) => `
      <tr>
        <td style="padding:10px 16px;color:rgba(255,255,255,0.6);font-size:14px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="display:inline-block;width:20px;color:rgba(255,255,255,0.25);font-size:12px;">${i + 1}.</span>
          ${c.category}
        </td>
        <td style="padding:10px 16px;color:rgba(255,255,255,0.3);font-size:13px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.04);">${c.count} occurrences</td>
      </tr>`).join("")
    : `<tr><td style="padding:16px;color:rgba(255,255,255,0.3);font-size:13px;text-align:center;">No issues this period</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:48px 24px;">

    <div style="text-align:center;margin-bottom:40px;">
      <div style="display:inline-block;width:40px;height:40px;border-radius:12px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);line-height:40px;text-align:center;color:#34d399;font-size:16px;font-weight:700;">L</div>
      <p style="color:rgba(255,255,255,0.3);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:12px 0 0;">Team Report</p>
    </div>

    <h1 style="color:#e5e5e5;font-size:24px;font-weight:600;margin:0 0 8px;text-align:center;">
      ${data.periodLabel}
    </h1>
    <p style="color:rgba(255,255,255,0.3);font-size:14px;text-align:center;margin:0 0 32px;">
      Hi ${data.userName}, here&rsquo;s your team&rsquo;s code quality summary.
    </p>

    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:50%;padding:0 6px 12px 0;vertical-align:top;">
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;text-align:center;">
              <p style="color:rgba(255,255,255,0.3);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Avg Score</p>
              <p style="color:${scoreColor};font-size:36px;font-weight:700;margin:0;">${data.avgScore ?? "&mdash;"}</p>
              ${arrow ? `<p style="margin:4px 0 0;">${arrow}</p>` : ""}
            </div>
          </td>
          <td style="width:50%;padding:0 0 12px 6px;vertical-align:top;">
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;text-align:center;">
              <p style="color:rgba(255,255,255,0.3);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">PRs Reviewed</p>
              <p style="color:#e5e5e5;font-size:36px;font-weight:700;margin:0;">${data.totalPRs}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="width:50%;padding:0 6px 0 0;vertical-align:top;">
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;text-align:center;">
              <p style="color:rgba(255,255,255,0.3);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Issues Caught</p>
              <p style="color:${data.totalIssues > 0 ? "#fbbf24" : "#34d399"};font-size:36px;font-weight:700;margin:0;">${data.totalIssues}</p>
            </div>
          </td>
          <td style="width:50%;padding:0 0 0 6px;vertical-align:top;">
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;text-align:center;">
              <p style="color:rgba(255,255,255,0.3);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Most Active</p>
              <p style="color:#e5e5e5;font-size:14px;font-weight:600;margin:0;word-break:break-all;">${data.mostActiveRepo ?? "&mdash;"}</p>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:16px 16px 8px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <p style="color:rgba(255,255,255,0.3);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0;">Top Issue Categories</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${categoriesHtml}
      </table>
    </div>

    <div style="text-align:center;margin-bottom:32px;">
      <a href="${data.dashboardUrl}" style="display:inline-block;background:#34d399;color:#000;font-size:14px;font-weight:600;padding:12px 32px;border-radius:999px;text-decoration:none;">View Full Dashboard</a>
    </div>

    <div style="text-align:center;padding-top:24px;border-top:1px solid rgba(255,255,255,0.04);">
      <p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0 0 4px;">Lintly — your codebase&rsquo;s immune system</p>
      <a href="${data.unsubscribeUrl}" style="color:rgba(255,255,255,0.2);font-size:11px;text-decoration:underline;">Manage report preferences</a>
    </div>
  </div>
</body>
</html>`;
}
