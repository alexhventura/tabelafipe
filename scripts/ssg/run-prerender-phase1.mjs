import { spawnSync } from 'child_process';

process.env.SSG_LIMIT_VEHICLES = '100';
process.env.SSG_LIMIT_FAMILIES = '50';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('node', ['scripts/prebuild.js']);
run('npx', ['vite', 'build']);
run('npx', ['tsx', 'scripts/ssg/prerender-spa.ts']);
run('npx', ['tsx', 'scripts/ssg/prerender-audit.ts']);
