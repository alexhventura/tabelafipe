import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import fipeRoutes from './routes/fipeRoutes.js';
import { initDatabase, getDbPath, closeDb } from './db/fipeDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.API_PORT || '3001', 10);

const app = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: getDbPath() });
});

app.use('/api/fipe', fipeRoutes);

app.use('/examples', express.static(path.join(__dirname, '../public/examples')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Erro interno do servidor' });
});

try {
  initDatabase({ createIfMissing: true });
  console.log(`FIPE DB: ${getDbPath()}`);

  app.listen(PORT, () => {
    console.log(`API FIPE local: http://localhost:${PORT}`);
    console.log(`  GET /api/fipe/marcas`);
    console.log(`  GET /api/fipe/modelos?marcaId=`);
    console.log(`  GET /api/fipe/anos?marcaId=&modeloId=`);
    console.log(`  GET /api/fipe/preco?marcaId=&modeloId=&anoId=`);
    console.log(`  Exemplo: http://localhost:${PORT}/examples/fipe-cascata.html`);
  });
} catch (err) {
  console.error('Falha ao iniciar servidor:', err.message);
  process.exit(1);
}

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
