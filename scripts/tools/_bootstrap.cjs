const fs = require("fs");
const path = require("path");
const root = process.cwd();
function w(rel, lines) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const content = Array.isArray(lines) ? lines.join("\n") + "\n" : lines;
  fs.writeFileSync(p, content, "utf8");
  const nulls = fs.readFileSync(p).filter((b) => b === 0).length;
  if (nulls) throw new Error(rel + " has null bytes: " + nulls);
  console.log("wrote", rel);
}
module.exports = { w, root };