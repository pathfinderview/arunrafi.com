import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../..');
const kit=process.env.TEARDOWN_DIR || path.resolve(root,'../experiments/teardown');
const result=spawnSync(process.execPath,[path.join(kit,'sims/build.mjs'),dir],{cwd:root,stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const dist=path.join(root,'teardown-out/dist');
const file=path.join(dist,'earthworm.html');
const built=path.join(dist,`${path.basename(dir)}.html`);
let html=fs.readFileSync(built,'utf8').replace(/<title>[^<]*<\/title>/,'<title>A life beneath our feet — Arun Rafi</title>');
html=html.replace('<div id="app"></div>','<div id="app"></div><noscript><p>This earthworm needs JavaScript to move. Please turn it on, or <a href="https://arunrafi.com/tools.html">explore the other tools</a>.</p></noscript>');
html=html.replace('</head>',`<meta name="description" content="Explore a 3D earthworm and four hands-on experiments: squeeze its muscles, test its grip, trace oxygen and follow food. Simple lessons to share.">
<meta property="og:title" content="A life beneath our feet — Arun Rafi">
<meta property="og:description" content="No legs. No lungs. No bones. Look inside an earthworm and learn together.">
<meta property="og:type" content="website">
<meta name="theme-color" content="#f5f3ed">
</head>`);
const notices=[['Teardown',path.join(kit,'LICENSE')],['Three.js',path.join(kit,'node_modules/three/LICENSE')],['Inter',path.join(kit,'node_modules/@fontsource-variable/inter/LICENSE')],['JetBrains Mono',path.join(kit,'node_modules/@fontsource/jetbrains-mono/LICENSE')]].map(([name,file])=>`${name}\n${fs.readFileSync(file,'utf8')}`).join('\n\n');
html=html.replace('</html>',`<!-- Third-party notices\n${notices}\n-->\n</html>`);
fs.writeFileSync(file,html);
fs.writeFileSync(path.join(dist,'earthworm-LICENSES.txt'),notices);
console.log(`Ready: ${file} (${Math.round(Buffer.byteLength(html)/1024)} KB), offline and self-contained.`);
