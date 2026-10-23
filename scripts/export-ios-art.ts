/**
 * Writes the counting game's drawings (src/games/counting/skyArt.ts) into the
 * iOS asset catalog as vector SVG image sets, and the milestone friends
 * (MILESTONES in scenery.ts) into CountingCore, so both apps draw the same sky.
 * Run after changing either:
 *
 *   node --experimental-strip-types scripts/export-ios-art.ts
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MILESTONES } from '../src/games/counting/scenery.ts';
import { ART, COLORS, FLAME, GROUND, ROCKET, artSvg } from '../src/games/counting/skyArt.ts';

const OUT = join(import.meta.dirname, '../ios/CountToTheSky/Assets.xcassets/Art');
const MILESTONES_SWIFT = join(import.meta.dirname, '../ios/CountingCore/Sources/CountingCore/Milestones.swift');

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
  comet: ART.comet(),
  rocket: ROCKET,
  flame: FLAME,
};
for (const m of MILESTONES) art[m.art] = artSvg(m.art);
COLORS.forEach((c, i) => (art[`planet${i}`] = ART.planet(c)));
// The ground: hills, then the props in the order skyArt.ts lists them.
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

/** height / width of a drawing, from its view box. */
function aspect(svg: string): number {
  const [, , w, h] = svg.match(/viewBox="([^"]*)"/)![1].split(' ').map(Number);
  return h / w;
}

const rows = MILESTONES.map(
  (m) => `    Milestone(count: ${m.count}, art: "${m.art}", width: ${m.width}, aspect: ${+aspect(art[m.art]).toFixed(6)}),`,
);
writeFileSync(
  MILESTONES_SWIFT,
  `// Generated from MILESTONES in src/games/counting/scenery.ts by
// scripts/export-ios-art.ts. Do not edit: change the web table and rerun it.

/// A new friend every ten numbers, from the hills up to the sun.
public let milestones: [Milestone] = [
${rows.join('\n')}
]
`,
);
console.log(`wrote ${MILESTONES.length} milestones to ${MILESTONES_SWIFT}`);
