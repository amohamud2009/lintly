import { reviewDiff } from "../lib/claude";

const SAMPLE_DIFF = `
diff --git a/src/api/users.ts b/src/api/users.ts
index abc123..def456 100644
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -1,5 +1,45 @@
+import express from "express";
+import { db } from "../db";
+
+const router = express.Router();
+
+// Get user by ID
+router.get("/users/:id", async (req, res) => {
+  try {
+    const user = await db.query(\`SELECT * FROM users WHERE id = \${req.params.id}\`);
+    res.json(user.rows[0]);
+  } catch (err) {
+    res.status(500).json({ error: "Internal server error" });
+  }
+});
+
+// Create user
+router.post("/users", async (req, res) => {
+  const { name, email, password } = req.body;
+  try {
+    const hashedPassword = password; // TODO: hash later
+    const result = await db.query(
+      \`INSERT INTO users (name, email, password) VALUES ('\${name}', '\${email}', '\${hashedPassword}')\`
+    );
+    res.json({ id: result.rows[0].id, token: Buffer.from(email).toString("base64") });
+  } catch {
+    res.status(400).json({ error: "Failed" });
+  }
+});
+
+// Delete all user data  
+router.delete("/users/:id", async (req, res) => {
+  await db.query(\`DELETE FROM users WHERE id = \${req.params.id}\`);
+  await db.query(\`DELETE FROM orders WHERE user_id = \${req.params.id}\`);
+  await db.query(\`DELETE FROM sessions WHERE user_id = \${req.params.id}\`);
+  res.json({ deleted: true });
+});
+
+// Fetch user preferences using new Prisma API
+router.get("/users/:id/prefs", async (req, res) => {
+  const prefs = await db.user.findUnique({ where: { id: req.params.id } }).preferences();
+  res.json(prefs);
+});
+
+export default router;
`;

async function main() {
  console.log("Testing reviewDiff with AI Code Mode ENABLED...\n");
  console.log("=".repeat(60));

  const result = await reviewDiff(SAMPLE_DIFF, {
    aiCodeMode: true,
    severityThreshold: "all",
  });

  console.log(`\nScore: ${result.score}/100`);
  console.log(`Summary: ${result.summary}`);
  console.log(`Top Fix: ${result.topFix}`);
  console.log(`Praise: ${result.praise}`);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${result.comments.length} comments:\n`);

  for (const c of result.comments) {
    const isAiRisk = c.category === "ai-risk";
    const badge = isAiRisk ? " [AI RISK]" : "";
    console.log(`--- ${c.severity.toUpperCase()}${badge} | ${c.category} | ${c.path}:${c.line}`);
    console.log(`    ${c.body.slice(0, 200)}`);
    if (c.suggestedFix) {
      console.log(`    Fix: ${c.suggestedFix.slice(0, 150)}...`);
    }
    console.log();
  }

  const aiRiskCount = result.comments.filter((c) => c.category === "ai-risk").length;
  console.log(`${"=".repeat(60)}`);
  console.log(`AI Risk comments: ${aiRiskCount}/${result.comments.length}`);
  console.log(`Categories: ${Array.from(new Set(result.comments.map((c) => c.category))).join(", ")}`);
}

main().catch(console.error);
