/**
 * Remove dist/ de forma robusta (Windows ENOTEMPTY, paths longos, locks temporários).
 */
import fs from 'fs';
import path from 'path';

const DIST = path.join(process.cwd(), 'dist');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanDist() {
  if (!fs.existsSync(DIST)) {
    console.log('clean-dist: dist/ inexistente.');
    return;
  }

  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.rmSync(DIST, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
      console.log('clean-dist: dist/ removido.');
      return;
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? err.code : 'UNKNOWN';
      if (attempt === maxAttempts) {
        console.error(`clean-dist: falha após ${maxAttempts} tentativas (${code}).`);
        throw err;
      }
      console.warn(`clean-dist: tentativa ${attempt}/${maxAttempts} falhou (${code}), repetindo...`);
      await sleep(400 * attempt);
    }
  }
}

await cleanDist();
