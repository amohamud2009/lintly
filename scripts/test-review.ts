import { reviewDiff } from "../lib/claude";

const sampleDiff = `
+function getUser(id) {
+  const query = \`SELECT * FROM users WHERE id = \${id}\`;
+  return db.execute(query);
+}
`;

async function main() {
  console.log("Running Lintly AI review on sample diff...\n");
  const result = await reviewDiff(sampleDiff);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
