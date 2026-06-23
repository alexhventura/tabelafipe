const fs = require("fs");
const path = require("path");
const root = process.cwd();

function w(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", rel, content.length);
}

const fp = path.join(root, "scripts/lib/fipe-paths.ts");
let fpText = fs.readFileSync(fp, "utf8");
if (!fpText.includes("engineMaster:")) {
  const needle = "  maintenanceSpecs: path.join(ROOT, 'data', 'generated', 'maintenance-specs.json'),";
  const insert = needle + "\n  engineMaster: path.join(ROOT, 'data', 'generated', 'engine-master.json'),\n  maintenanceMaster: path.join(ROOT, 'data', 'generated', 'maintenance-master.json'),\n  acquisitionDashboard: path.join(ROOT, 'data', 'reports', 'acquisition-dashboard.json'),\n  documentAcquisitionLog: path.join(ROOT, 'data', 'document-library', 'acquisition-log.json'),";
  fpText = fpText.replace(needle, insert);
  fs.writeFileSync(fp, fpText, "utf8");
}

const dl = path.join(root, "scripts/lib/document-library.ts");
let dlText = fs.readFileSync(dl, "utf8");
if (!dlText.includes("maintenance-table")) {
  dlText = dlText.replace(
    '  | "technical-sheet";',
    '  | "technical-sheet"\n  | "maintenance-table"\n  | "historical-catalog";'
  );
  dlText = dlText.replace(
    '  if (/technical.?sheet|datasheet/.test(s)) return "technical-sheet";',
    '  if (/tabela.*manut|maintenance.?table|planilha.*revis/.test(s)) return "maintenance-table";\n  if (/historico|historical|linha.?do.?tempo|my\\d{2}/.test(s)) return "historical-catalog";\n  if (/technical.?sheet|datasheet/.test(s)) return "technical-sheet";'
  );
  fs.writeFileSync(dl, dlText, "utf8");
}

