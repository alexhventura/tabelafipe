const fs = require("fs");
const path = require("path");
const root = "c:/Users/Alex Ventura/Desktop/consulta-tabela-fipe";
const fp = path.join(root, "scripts/lib/fipe-paths.ts");
let s = fs.readFileSync(fp, "utf8");
if (!s.includes("vehicleBundlesRoot")) {
  s = s.replace(
    /legacySearchDir: path\.join\(ROOT, 'public', 'api', 'fipe', 'search'\),\r?\n\} as const;/,
    "legacySearchDir: path.join(ROOT, 'public', 'api', 'fipe', 'search'),\r\n  vehicleBundlesRoot: path.join(ROOT, 'public', 'data', 'bundles'),\r\n  vehicleBundleManifest: path.join(ROOT, 'public', 'data', 'bundles', 'manifest.json'),\r\n  vehicleUrlMap: path.join(ROOT, 'data', 'generated', 'vehicle-url-map.json'),\r\n  vehicleBundleAudit: path.join(ROOT, 'data', 'reports', 'vehicle-bundle-architecture-audit.json'),\r\n} as const;"
  );
  fs.writeFileSync(fp, s, "utf8");
  console.log("patched");
} else console.log("already");
