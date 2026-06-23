import fs from "fs";
import path from "path";
import { PATHS } from "../../lib/fipe-paths.js";
import { crawlAllAdapters } from "./adapters/registry.js";

async function main() {
  fs.mkdirSync(PATHS.rawManufacturers, { recursive: true });
  const discover = process.argv.includes("--discover");
  const slugs = process.argv.includes("--all")
    ? undefined
    : process.argv.find((a) => a.startsWith("--brand="))?.split("=")[1]?.split(",");
  const { results, records } = await crawlAllAdapters(slugs, { discover });
  for (const [slug, rows] of records) {
    const dest = path.join(PATHS.rawManufacturers, slug + ".json");
    if (!rows.length && fs.existsSync(dest)) continue;
    if (rows.length) fs.writeFileSync(dest, JSON.stringify(rows, null, 2), "utf8");
  }
  const log = { geradoEm: new Date().toISOString(), discover, results, total: results.reduce((s, r) => s + r.registros, 0) };
  fs.writeFileSync(path.join(PATHS.rawManufacturers, "crawl-log.json"), JSON.stringify(log, null, 2), "utf8");
  console.log(JSON.stringify({ marcas: results.length, total: log.total, discover }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
