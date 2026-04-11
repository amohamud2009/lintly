import { serve } from "inngest/next";
import { inngest, reviewPullRequest } from "@/inngest/review";
import { scanPush } from "@/inngest/security-scan";
import { sendDailyDigest, sendUserDigest } from "@/inngest/digest";
import { detectPatterns } from "@/inngest/patterns";
import { sendTeamReports, sendUserTeamReport } from "@/inngest/team-report";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [reviewPullRequest, scanPush, sendDailyDigest, sendUserDigest, detectPatterns, sendTeamReports, sendUserTeamReport],
});
