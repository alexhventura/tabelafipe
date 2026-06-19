import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const DB = path.join(ROOT, "fipe.db");
const schema = fs.readFileSync(path.join(ROOT, "server", "db", "schema.sql"), "utf-8");
const db = new Database(DB);
db.exec(schema);
db.close();
console.log("Banco inicializado:", DB);