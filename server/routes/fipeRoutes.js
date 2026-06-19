import { Router } from 'express';
import {
  listMarcas,
  listModelos,
  listAnos,
  getPreco,
  getStats,
  buscaLocal,
} from '../controllers/fipeController.js';

const router = Router();

router.get('/marcas', listMarcas);
router.get('/modelos', listModelos);
router.get('/anos', listAnos);
router.get('/preco', getPreco);
router.get('/stats', getStats);
router.get('/busca', buscaLocal);

export default router;
