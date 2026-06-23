const fs = require("fs");
const path = require("path");
const target = process.argv[2];
if (!target) {
  console.error("usage: node write-ts.cjs <path>");
  process.exit(1);
}
const chunks = [];
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  const content = chunks.join("");
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  fs.writeFileSync(path.resolve(target), content, "utf8");
  console.log("wrote", target, content.length);
});
