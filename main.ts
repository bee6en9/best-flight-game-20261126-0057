// Ember Isle Run — the entry program (Node 22, standard library only).
// It hands the game in: it copies this directory's game/ and screenshots/
// to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library. The game itself is plain static files
// a desktop browser loads offline (game/index.html, its ES modules and the
// vendored three.js build under game/vendor/), with no network request.
//
// Run it outside the grader's container with MAKEFUN_OUTPUT_DIR in place
// of /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice: both runs must write byte-identical output.

// Fail fast with a clear message when the entry directory is incomplete,
// instead of letting the dossier builder throw a bare ENOENT.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

for (const needed of ['game', 'game/index.html', 'screenshots', 'vendor/makefun-game.ts']) {
  if (!existsSync(join(here, needed))) {
    throw new Error(`Ember Isle Run: missing ${needed} beside main.ts — cannot hand in an incomplete entry`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (gate.json): only text_max_bytes shapes the bytes;
// the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files in all, or a path under game/ over 1000 bytes: game/
// counts beside /output's own 1000-entry cap, its screenshots/ and
// dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
