/**
 * Writes the counting game's drawings (src/games/counting/Sky.ts) into the iOS
 * asset catalog as vector SVG image sets, so both apps draw the same art.
 * Run after changing the drawings:
 *
 *   node --experimental-strip-types scripts/export-ios-art.ts
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ART, COLORS, FLAME, GROUND, ROCKET } from '../src/games/counting/Sky.ts';

const OUT = join(import.meta.dirname, '../ios/CountToTheSky/Assets.xcassets/Art');

/** Standalone SVG file: namespace and size added, CSS classes dropped. */
function file(svg: string): string {
  if (!/<svg[^>]* width=/.test(svg)) {
    const [, , w, h] = svg.match(/viewBox="([^"]*)"/)![1].split(' ');
    svg = svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
  }
  return svg
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/ class="[^"]*"/g, '')
    .replace(/ aria-hidden="true"/g, '')
    .replace(/="\./g, '="0.')
    .replace(/\n\s*/g, '\n');
}

const art: Record<string, string> = {
  cloud: ART.cloud(1),
  bird: ART.bird(),
  hotAir: ART.hotAir(),
  kite: ART.kite(),
  plane: ART.plane(),
  satellite: ART.satellite(),
  moon: ART.moon(),
  ufo: ART.ufo(),
  saturn: ART.saturn(),
  comet: ART.comet(),
  astronaut: ART.astronaut(),
  galaxy: ART.galaxy(),
  rocket: ROCKET,
  flame: FLAME,
};
COLORS.forEach((c, i) => {
  art[`balloon${i}`] = ART.balloon(c);
  art[`planet${i}`] = ART.planet(c);
});
// The ground: hills, then the props in the order Sky.ts lists them.
const groundSvgs = GROUND.match(/<svg[\s\S]*?<\/svg>/g)!;
['groundHills', 'tree1', 'tree2', 'house', 'flower1', 'flower2', 'pad'].forEach((name, i) => (art[name] = groundSvgs[i]));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'Contents.json'), JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2) + '\n');
for (const [name, svg] of Object.entries(art)) {
  const dir = join(OUT, `${name}.imageset`);
  mkdirSync(dir);
  writeFileSync(join(dir, `${name}.svg`), file(svg) + '\n');
  writeFileSync(
    join(dir, 'Contents.json'),
    JSON.stringify(
      {
        images: [{ filename: `${name}.svg`, idiom: 'universal' }],
        info: { author: 'xcode', version: 1 },
        properties: { 'preserves-vector-representation': true },
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(`wrote ${Object.keys(art).length} image sets to ${OUT}`);
