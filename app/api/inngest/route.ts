import { serve } from "inngest/next";
import { inngest, reviewPullRequest } from "@/inngest/review";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [reviewPullRequest],
});
