const url =
  'https://pesquisatabelafipe.com.br/fipe/aston-martin/rapide-6-0-v12-477cv-2012-085007-1/';
const res = await fetch(url);
const c = await res.text();
const markers = [
  'min-h-screen',
  '<footer',
  'data-prerender="vehicle"',
  '__VEHICLE_BUNDLE__',
  'spa-prerender',
];
for (const s of markers) console.log(s + ':', c.includes(s));
const i = c.indexOf('<div id="root"');
console.log('\n--- root snippet (first 3000 chars) ---\n');
console.log(c.slice(i, i + 3000));
