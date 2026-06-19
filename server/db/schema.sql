PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tipos (
  id INTEGER PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL
);

INSERT OR IGNORE INTO tipos (id, codigo, nome) VALUES
  (1, 'carros', 'Carros'),
  (2, 'motos', 'Motos'),
  (3, 'caminhoes', 'Caminhoes');

CREATE TABLE IF NOT EXISTS marcas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_id INTEGER NOT NULL REFERENCES tipos(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  UNIQUE(tipo_id, codigo)
);

CREATE TABLE IF NOT EXISTS modelos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  marca_id INTEGER NOT NULL REFERENCES marcas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  UNIQUE(marca_id, codigo)
);

CREATE TABLE IF NOT EXISTS anos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modelo_id INTEGER NOT NULL REFERENCES modelos(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  ano INTEGER,
  combustivel TEXT,
  codigo_fipe TEXT,
  valor REAL,
  mes_referencia TEXT,
  UNIQUE(modelo_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_marcas_tipo ON marcas(tipo_id);
CREATE INDEX IF NOT EXISTS idx_modelos_marca ON modelos(marca_id);
CREATE INDEX IF NOT EXISTS idx_anos_modelo ON anos(modelo_id);