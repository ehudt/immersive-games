/**
 * The counting game's drawings: the rocket, the ground and the scenery of the
 * sky. Procedural inline SVG, no asset files; scripts/export-ios-art.ts writes
 * the same drawings into the iOS app's asset catalog.
 */

export const COLORS = ['#ff5d8f', '#ffb627', '#2ec4d6', '#7bd35a', '#a374ff', '#ff8a3d'];

export const svg = (w: number, h: number, body: string, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;

const balloon = (c: string) =>
  svg(
    40,
    90,
    `<path d="M20 52 Q16 70 22 88" stroke="#666" stroke-width="1.5" fill="none"/>
     <ellipse cx="20" cy="26" rx="17" ry="22" fill="${c}"/><path d="M17 48 L23 48 L20 53Z" fill="${c}"/>
     <ellipse cx="13" cy="17" rx="4" ry="7" fill="#fff" opacity=".45"/>`,
    'deco-balloon',
  );

export const ART = {
  cloud: (s: number) =>
    svg(
      120,
      60,
      `<g fill="#fff"><circle cx="35" cy="35" r="20"/><circle cx="60" cy="25" r="24"/><circle cx="85" cy="36" r="18"/><rect x="20" y="34" width="82" height="22" rx="11"/></g>
       <path d="M24 50 Q60 60 100 50" stroke="#d6ecff" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      `deco-cloud s${s}`,
    ),
  bird: () =>
    svg(40, 20, `<path d="M2 12 Q10 2 20 12 Q30 2 38 12" stroke="#2a3550" stroke-width="3" fill="none" stroke-linecap="round"/>`, 'deco-bird'),
  hotAir: () =>
    svg(
      90,
      120,
      `<path d="M45 4 C10 4 4 40 20 62 L34 84 L56 84 L70 62 C86 40 80 4 45 4Z" fill="#ff5d8f"/>
       <path d="M45 4 C30 4 26 40 34 62 L40 84 L50 84 L56 62 C64 40 60 4 45 4Z" fill="#ffd23f"/>
       <path d="M45 4 C40 4 39 40 42 62 L44 84 L46 84 L48 62 C51 40 50 4 45 4Z" fill="#2ec4d6"/>
       <path d="M36 84 L38 98 M54 84 L52 98" stroke="#7a4b2a" stroke-width="2"/>
       <rect x="34" y="98" width="22" height="16" rx="3" fill="#a0632e"/>`,
      'deco-hotair',
    ),
  kite: () =>
    svg(
      70,
      110,
      `<path d="M35 2 L60 30 L35 70 L10 30Z" fill="#7bd35a"/><path d="M35 2 L35 70 M10 30 L60 30" stroke="#fff" stroke-width="2"/>
       <path d="M35 70 Q25 80 38 88 Q50 96 36 108" stroke="#ff8a3d" stroke-width="2.5" fill="none"/>
       <circle cx="30" cy="80" r="3" fill="#ff5d8f"/><circle cx="42" cy="92" r="3" fill="#ffb627"/>`,
      'deco-kite',
    ),
  plane: () =>
    svg(
      150,
      60,
      `<path d="M10 32 Q12 22 30 22 L118 22 Q140 24 144 32 Q140 40 118 42 L30 42 Q12 42 10 32Z" fill="#fff"/>
       <path d="M70 26 L48 2 L62 2 L92 26Z M72 38 L52 58 L66 58 L94 38Z" fill="#2ec4d6"/>
       <path d="M14 30 L6 8 L20 8 L32 24Z" fill="#ff5d8f"/>
       <g fill="#4a6fd8"><circle cx="100" cy="30" r="3.5"/><circle cx="88" cy="30" r="3.5"/><circle cx="76" cy="30" r="3.5"/><circle cx="64" cy="30" r="3.5"/></g>`,
      'deco-plane',
    ),
  satellite: () =>
    svg(
      120,
      60,
      `<rect x="2" y="18" width="38" height="24" fill="#3e64c8" stroke="#9fc1ff" stroke-width="2"/>
       <rect x="80" y="18" width="38" height="24" fill="#3e64c8" stroke="#9fc1ff" stroke-width="2"/>
       <path d="M40 30 H80" stroke="#ccc" stroke-width="3"/><rect x="48" y="14" width="24" height="32" rx="4" fill="#e8e8f0"/>
       <circle cx="60" cy="8" r="5" fill="#ffd23f"/><path d="M60 13 V14" stroke="#ccc" stroke-width="2"/>`,
      'deco-satellite',
    ),
  moon: () =>
    svg(
      140,
      140,
      `<circle cx="70" cy="70" r="62" fill="#fff3c4"/><circle cx="48" cy="52" r="11" fill="#f0dc9a"/>
       <circle cx="90" cy="88" r="15" fill="#f0dc9a"/><circle cx="92" cy="44" r="7" fill="#f0dc9a"/><circle cx="52" cy="96" r="6" fill="#f0dc9a"/>
       <path d="M52 74 Q70 88 88 72" stroke="#c9a65a" stroke-width="3" fill="none" stroke-linecap="round"/>
       <circle cx="56" cy="64" r="3" fill="#c9a65a"/><circle cx="84" cy="62" r="3" fill="#c9a65a"/>`,
      'deco-moon',
    ),
  ufo: () =>
    svg(
      110,
      60,
      `<ellipse cx="55" cy="26" rx="22" ry="18" fill="#bff6ff" opacity=".9"/><circle cx="55" cy="26" r="8" fill="#7bd35a"/>
       <circle cx="52" cy="24" r="1.6" fill="#123"/><circle cx="58" cy="24" r="1.6" fill="#123"/>
       <ellipse cx="55" cy="38" rx="52" ry="12" fill="#a374ff"/>
       <g fill="#ffd23f"><circle cx="22" cy="40" r="4"/><circle cx="42" cy="44" r="4"/><circle cx="68" cy="44" r="4"/><circle cx="88" cy="40" r="4"/></g>`,
      'deco-ufo',
    ),
  saturn: () =>
    svg(
      200,
      120,
      `<g transform="rotate(-12 100 62)"><ellipse cx="100" cy="62" rx="94" ry="20" fill="none" stroke="#e8c88a" stroke-width="8"/>
       <circle cx="100" cy="60" r="42" fill="#ffc46b"/><path d="M62 48 Q100 40 138 48 M60 68 Q100 60 140 68" stroke="#f09a4a" stroke-width="6" fill="none"/>
       <path d="M6 62 A94 20 0 0 0 194 62" fill="none" stroke="#ffe3a8" stroke-width="8"/></g>`,
      'deco-saturn',
    ),
  planet: (c: string) =>
    svg(
      90,
      90,
      `<circle cx="45" cy="45" r="40" fill="${c}"/><path d="M10 38 Q45 30 80 38 M8 54 Q45 62 82 54" stroke="#fff" stroke-width="5" opacity=".3" fill="none"/>
       <circle cx="32" cy="30" r="9" fill="#fff" opacity=".25"/>`,
      'deco-planet',
    ),
  comet: () =>
    svg(
      160,
      50,
      `<defs><linearGradient id="ct" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#bff6ff"/></linearGradient></defs>
       <path d="M0 18 L140 20 L140 30 L0 32Z" fill="url(#ct)"/><circle cx="140" cy="25" r="11" fill="#fff"/>`,
      'deco-comet',
    ),
  astronaut: () =>
    svg(
      90,
      110,
      `<rect x="24" y="44" width="42" height="44" rx="14" fill="#f4f6ff"/><rect x="30" y="54" width="18" height="12" rx="3" fill="#ff5d8f"/>
       <rect x="8" y="48" width="20" height="12" rx="6" fill="#f4f6ff" transform="rotate(-30 18 54)"/>
       <rect x="62" y="48" width="20" height="12" rx="6" fill="#f4f6ff" transform="rotate(30 72 54)"/>
       <rect x="28" y="84" width="14" height="22" rx="6" fill="#f4f6ff"/><rect x="48" y="84" width="14" height="22" rx="6" fill="#f4f6ff"/>
       <circle cx="45" cy="28" r="24" fill="#f4f6ff"/><circle cx="45" cy="28" r="17" fill="#2b3a7a"/>
       <circle cx="39" cy="22" r="5" fill="#fff" opacity=".6"/>`,
      'deco-astronaut',
    ),
  galaxy: () =>
    svg(
      160,
      120,
      `<defs><radialGradient id="gx"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ffb3f0"/><stop offset="1" stop-color="#7a5cff" stop-opacity="0"/></radialGradient></defs>
       <ellipse cx="80" cy="60" rx="76" ry="34" fill="url(#gx)" transform="rotate(-20 80 60)"/>`,
      'deco-galaxy',
    ),

  // The friends the rocket meets every ten numbers (MILESTONES in scenery.ts).
  redBalloon: () => balloon('#ff4d6d'),
  songbird: () =>
    svg(
      64,
      50,
      `<path d="M14 26 L0 16 L3 34Z" fill="#2e86de"/><ellipse cx="30" cy="30" rx="20" ry="16" fill="#4fa3ff"/>
       <ellipse cx="34" cy="36" rx="12" ry="8" fill="#ffe08a"/><circle cx="43" cy="21" r="12" fill="#4fa3ff"/>
       <path d="M20 26 Q26 6 40 22 Q32 32 20 26Z" fill="#2e86de"/>
       <path d="M54 19 L63 23 L54 27Z" fill="#ffb627"/><circle cx="47" cy="18" r="3" fill="#123"/><circle cx="48" cy="17" r="1" fill="#fff"/>
       <circle cx="44" cy="26" r="2.6" fill="#ff8fa3" opacity=".7"/>`,
      'deco-songbird',
    ),
  rcPlane: () =>
    svg(
      100,
      62,
      `<path d="M40 29 L28 4 L42 4 L56 29Z" fill="#ff5d8f"/><path d="M18 27 L10 9 L22 9 L30 27Z" fill="#2ec4d6"/>
       <rect x="12" y="24" width="70" height="16" rx="8" fill="#ffd23f"/><path d="M80 26 Q92 32 80 38Z" fill="#ff8a3d"/>
       <path d="M40 35 L28 60 L42 60 L56 35Z" fill="#e8467a"/>
       <rect x="88" y="30" width="5" height="4" fill="#666"/><ellipse cx="94" cy="32" rx="3" ry="15" fill="#cfd8ff" opacity=".8"/>
       <circle cx="66" cy="32" r="4.5" fill="#5fc3ff"/><path d="M20 24 L16 12" stroke="#555" stroke-width="1.5"/>`,
      'deco-rcplane',
    ),
  eagle: () =>
    svg(
      160,
      92,
      `<path d="M78 44 C60 18 30 10 2 16 L14 24 L6 30 L20 34 L12 42 L30 44 Q50 52 78 56Z" fill="#8a5a2b"/>
       <path d="M82 44 C100 18 130 10 158 16 L146 24 L154 30 L140 34 L148 42 L130 44 Q110 52 82 56Z" fill="#8a5a2b"/>
       <path d="M70 70 L80 90 L90 70Z" fill="#fff"/><ellipse cx="80" cy="54" rx="14" ry="20" fill="#6b3d1f"/>
       <circle cx="86" cy="32" r="12" fill="#fff"/><path d="M95 29 Q108 31 101 40 L96 36Z" fill="#ffb627"/>
       <circle cx="89" cy="29" r="2.2" fill="#123"/>`,
      'deco-eagle',
    ),
  cessna: () =>
    svg(
      150,
      70,
      `<path d="M14 34 L6 10 L22 10 L36 28Z" fill="#ff5d8f"/>
       <path d="M12 34 Q14 26 30 26 L112 24 Q132 26 136 36 Q132 46 112 46 L40 44 Q20 42 12 34Z" fill="#fff"/>
       <path d="M20 36 L133 36 L131 40 L22 40Z" fill="#2e86de"/>
       <rect x="80" y="28" width="12" height="7" rx="2" fill="#5fc3ff"/><rect x="96" y="28" width="14" height="7" rx="2" fill="#5fc3ff"/>
       <rect x="56" y="16" width="62" height="8" rx="4" fill="#e3e9fb"/><path d="M76 24 L86 40" stroke="#9aa6c8" stroke-width="2"/>
       <path d="M100 46 V54 M50 44 V52" stroke="#556" stroke-width="2.5"/><circle cx="100" cy="58" r="5" fill="#333"/><circle cx="50" cy="55" r="4" fill="#333"/>
       <circle cx="137" cy="36" r="4" fill="#ff5d8f"/><ellipse cx="141" cy="36" rx="3" ry="17" fill="#cfd8ff" opacity=".8"/>`,
      'deco-cessna',
    ),
  helicopter: () =>
    svg(
      140,
      80,
      `<rect x="62" y="6" width="6" height="12" fill="#556"/><rect x="10" y="3" width="110" height="5" rx="2.5" fill="#556"/>
       <path d="M44 42 L8 34 L8 42 L46 52Z" fill="#ff5d8f"/><path d="M4 30 L10 20 L15 36Z" fill="#e8467a"/>
       <circle cx="9" cy="37" r="9" fill="none" stroke="#556" stroke-width="2.5" opacity=".7"/>
       <path d="M40 48 Q40 18 72 18 Q104 18 108 46 Q106 62 80 62 L52 62 Q40 60 40 48Z" fill="#ff5d8f"/>
       <path d="M84 22 Q102 24 104 44 L84 44Z" fill="#bff6ff"/><rect x="50" y="46" width="30" height="5" rx="2" fill="#ffd23f"/>
       <path d="M54 62 V72 M92 62 V72" stroke="#556" stroke-width="3"/><path d="M42 74 H104" stroke="#556" stroke-width="4" stroke-linecap="round"/>`,
      'deco-helicopter',
    ),
  dragon: () =>
    svg(
      172,
      112,
      `<path d="M42 70 Q14 74 8 96 Q6 104 16 100 L12 108 L24 100 Q22 84 48 80Z" fill="#4caf50"/>
       <path d="M44 58 L48 48 L54 56 L58 46 L64 54 L68 46 L72 54Z" fill="#ffb627"/>
       <path d="M60 86 L56 98 L66 97Z M84 86 L84 98 L93 95Z" fill="#4caf50"/>
       <ellipse cx="70" cy="70" rx="34" ry="20" fill="#5fc24a"/><ellipse cx="74" cy="78" rx="24" ry="10" fill="#ffe08a"/>
       <path d="M92 64 Q110 40 124 38 Q140 34 150 42 Q157 50 148 56 Q138 60 124 56 Q112 62 102 78Z" fill="#5fc24a"/>
       <path d="M122 38 L117 22 L128 34Z M131 35 L134 20 L139 36Z" fill="#ffd23f"/>
       <path d="M62 56 Q58 14 96 4 Q88 24 100 30 Q84 34 92 46 Q80 46 80 58Z" fill="#2ec4d6"/>
       <circle cx="132" cy="44" r="5.5" fill="#fff"/><circle cx="133.5" cy="44" r="2.8" fill="#123"/>
       <circle cx="150" cy="46" r="1.8" fill="#2f7d32"/><path d="M137 52 Q143 56 149 52" stroke="#2f7d32" stroke-width="2" fill="none" stroke-linecap="round"/>
       <path d="M156 48 Q166 40 171 48 Q166 56 156 52Z" fill="#ff8a3d"/><path d="M157 49 Q163 45 166 49 Q163 52 157 51Z" fill="#ffd23f"/>`,
      'deco-dragon',
    ),
  zeppelin: () =>
    svg(
      180,
      78,
      `<path d="M22 30 L4 6 L28 16Z M22 38 L4 62 L28 52Z" fill="#a374ff"/>
       <ellipse cx="94" cy="34" rx="80" ry="28" fill="#c9d3ff"/><ellipse cx="94" cy="36" rx="80" ry="7" fill="#a374ff" opacity=".55"/>
       <ellipse cx="86" cy="18" rx="48" ry="6" fill="#fff" opacity=".55"/>
       <rect x="78" y="60" width="32" height="12" rx="5" fill="#7a86b8"/>
       <g fill="#ffd23f"><circle cx="86" cy="66" r="2.5"/><circle cx="94" cy="66" r="2.5"/><circle cx="102" cy="66" r="2.5"/></g>`,
      'deco-zeppelin',
    ),
  jets: () => {
    const jet = (x: number, y: number, trail: string, id: string) =>
      `<defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${trail}" stop-opacity="0"/><stop offset="1" stop-color="${trail}" stop-opacity=".85"/></linearGradient></defs>
       <rect x="0" y="${y + 3}" width="${x + 4}" height="8" rx="4" fill="url(#${id})"/>
       <g transform="translate(${x} ${y})"><path d="M2 6 L-2 -3 L4 -3 L9 5Z" fill="#2e86de"/>
       <path d="M0 7 Q2 3 8 3 L30 4 Q38 6 38 7 Q38 8 30 10 L8 11 Q2 11 0 7Z" fill="#fff"/>
       <path d="M14 8 L8 18 L14 18 L24 8Z" fill="#2e86de"/><ellipse cx="27" cy="6" rx="4" ry="2" fill="#5fc3ff"/></g>`;
    return svg(170, 92, jet(108, 10, '#ff5d8f', 'jt1') + jet(130, 40, '#ffd23f', 'jt2') + jet(108, 70, '#2ec4d6', 'jt3'), 'deco-jets');
  },
  weatherBalloon: () =>
    svg(
      80,
      146,
      `<path d="M40 80 V128" stroke="#888" stroke-width="1.5"/><path d="M34 74 L46 74 L40 82Z" fill="#e6ebff"/>
       <circle cx="40" cy="40" r="36" fill="#f4f6ff"/><ellipse cx="48" cy="50" rx="22" ry="18" fill="#dfe6ff" opacity=".7"/>
       <ellipse cx="27" cy="26" rx="8" ry="12" fill="#fff"/>
       <rect x="30" y="128" width="20" height="14" rx="2" fill="#ff8a3d"/><path d="M50 131 L60 121" stroke="#555" stroke-width="2"/>
       <circle cx="60" cy="121" r="2.5" fill="#ff5d8f"/>`,
      'deco-weatherballoon',
    ),
  carpet: () =>
    svg(
      150,
      70,
      `<path d="M12 40 L3 37 M12 46 L3 46 M12 52 L3 55 M138 40 L147 37 M138 46 L147 46 M138 52 L147 55" stroke="#ffd23f" stroke-width="2.5" stroke-linecap="round"/>
       <path d="M12 40 Q42 26 75 40 T138 40 L138 52 Q108 66 75 52 T12 52Z" fill="#a374ff" stroke="#ffd23f" stroke-width="3" stroke-linejoin="round"/>
       <path d="M24 44 Q48 36 75 46 T126 46" stroke="#ff5d8f" stroke-width="3" fill="none"/>
       <g fill="#ffb627"><path d="M44 42 L48 38 L52 42 L48 46Z"/><path d="M71 45 L75 41 L79 45 L75 49Z"/><path d="M98 46 L102 42 L106 46 L102 50Z"/></g>`,
      'deco-carpet',
    ),
  shuttle: () =>
    svg(
      90,
      140,
      `<ellipse cx="38" cy="126" rx="4" ry="11" fill="#ffb627"/><ellipse cx="52" cy="126" rx="4" ry="11" fill="#ffb627"/>
       <ellipse cx="38" cy="122" rx="2" ry="6" fill="#fff1a8"/><ellipse cx="52" cy="122" rx="2" ry="6" fill="#fff1a8"/>
       <rect x="33" y="108" width="10" height="8" fill="#7a86b8"/><rect x="47" y="108" width="10" height="8" fill="#7a86b8"/>
       <path d="M32 66 L6 110 L32 110Z M58 66 L84 110 L58 110Z" fill="#f4f6ff"/>
       <path d="M6 110 L12 100 L32 100 L32 110Z M84 110 L78 100 L58 100 L58 110Z" fill="#2a3550"/>
       <path d="M45 4 Q58 16 58 40 L58 110 L32 110 L32 40 Q32 16 45 4Z" fill="#fdfdff"/>
       <path d="M45 4 Q54 12 56 24 L34 24 Q36 12 45 4Z" fill="#2a3550"/>
       <rect x="38" y="30" width="14" height="6" rx="2" fill="#2a3550"/><rect x="32" y="56" width="26" height="4" fill="#ff5d8f"/>`,
      'deco-shuttle',
    ),
  station: () =>
    svg(
      170,
      98,
      `<rect x="4" y="46" width="162" height="6" fill="#c9d3ff"/>
       <g fill="#3e64c8" stroke="#9fc1ff" stroke-width="2"><rect x="10" y="8" width="26" height="36"/><rect x="10" y="54" width="26" height="36"/>
       <rect x="134" y="8" width="26" height="36"/><rect x="134" y="54" width="26" height="36"/></g>
       <path d="M10 26 H36 M10 72 H36 M134 26 H160 M134 72 H160" stroke="#9fc1ff" stroke-width="1.5"/>
       <rect x="46" y="56" width="10" height="24" fill="#fff" opacity=".85"/><rect x="114" y="18" width="10" height="24" fill="#fff" opacity=".85"/>
       <rect x="62" y="38" width="46" height="22" rx="8" fill="#e8e8f0"/><rect x="76" y="22" width="18" height="54" rx="6" fill="#f4f6ff"/>
       <circle cx="85" cy="49" r="6" fill="#5fc3ff"/><circle cx="85" cy="18" r="3" fill="#ff5d8f"/>`,
      'deco-station',
    ),
  mars: () =>
    svg(
      100,
      100,
      `<circle cx="50" cy="50" r="46" fill="#e8673c"/>
       <path d="M12 42 Q50 30 88 44 M8 62 Q42 72 90 58" stroke="#c24a2a" stroke-width="7" fill="none" opacity=".6"/>
       <path d="M36 9 Q50 3 64 9 Q50 15 36 9Z" fill="#fff" opacity=".9"/>
       <circle cx="34" cy="76" r="6" fill="#c24a2a" opacity=".7"/><circle cx="70" cy="28" r="4" fill="#c24a2a" opacity=".7"/>
       <circle cx="34" cy="30" r="12" fill="#fff" opacity=".18"/>`,
      'deco-mars',
    ),
  alien: () =>
    svg(
      100,
      116,
      `<path d="M38 20 L30 6 M62 20 L70 6" stroke="#5fc24a" stroke-width="3"/><circle cx="30" cy="5" r="4" fill="#ffd23f"/><circle cx="70" cy="5" r="4" fill="#ffd23f"/>
       <path d="M66 64 Q84 60 88 42 M34 64 Q22 74 20 88" stroke="#7bd35a" stroke-width="8" fill="none" stroke-linecap="round"/>
       <circle cx="88" cy="38" r="6" fill="#7bd35a"/>
       <rect x="36" y="90" width="10" height="20" rx="5" fill="#7bd35a"/><rect x="54" y="90" width="10" height="20" rx="5" fill="#7bd35a"/>
       <path d="M34 58 Q50 54 66 58 L70 94 Q50 100 30 94Z" fill="#a374ff"/><circle cx="50" cy="74" r="5" fill="#ffd23f"/>
       <ellipse cx="50" cy="36" rx="28" ry="24" fill="#7bd35a"/>
       <ellipse cx="40" cy="34" rx="7" ry="9" fill="#fff"/><ellipse cx="60" cy="34" rx="7" ry="9" fill="#fff"/>
       <circle cx="41" cy="36" r="3.5" fill="#123"/><circle cx="61" cy="36" r="3.5" fill="#123"/>
       <path d="M42 48 Q50 54 58 48" stroke="#2f7d32" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
      'deco-alien',
    ),
  jupiter: () =>
    svg(
      120,
      120,
      `<defs><clipPath id="jp"><circle cx="60" cy="60" r="56"/></clipPath></defs>
       <circle cx="60" cy="60" r="56" fill="#ecc89c"/>
       <g clip-path="url(#jp)"><rect y="14" width="120" height="10" fill="#c98a5a"/><rect y="34" width="120" height="12" fill="#b8704a"/>
       <rect y="56" width="120" height="8" fill="#f6e2c0"/><rect y="72" width="120" height="12" fill="#c98a5a"/><rect y="94" width="120" height="8" fill="#b8704a"/>
       <ellipse cx="78" cy="78" rx="12" ry="7" fill="#d9573a"/></g>
       <circle cx="40" cy="38" r="16" fill="#fff" opacity=".18"/>`,
      'deco-jupiter',
    ),
  spaceWhale: () =>
    svg(
      170,
      100,
      `<path d="M36 52 Q20 40 6 22 Q20 26 26 36 Q20 26 24 12 Q36 30 44 50Z" fill="#4a6fd8"/>
       <path d="M30 50 Q40 22 96 22 Q150 24 164 56 Q168 80 130 84 L70 84 Q44 80 30 50Z" fill="#4a6fd8"/>
       <path d="M70 84 Q120 92 150 76 Q130 70 90 72 Q76 74 70 84Z" fill="#9fc1ff"/>
       <path d="M100 74 Q96 90 84 96 Q104 94 112 76Z" fill="#3a5bc0"/>
       <g fill="#fff6c4"><circle cx="78" cy="40" r="2.5"/><circle cx="100" cy="32" r="2"/><circle cx="112" cy="48" r="2.5"/><circle cx="60" cy="54" r="2"/></g>
       <circle cx="138" cy="52" r="4" fill="#123"/><circle cx="139.5" cy="50.5" r="1.3" fill="#fff"/>
       <path d="M146 66 Q154 68 160 62" stroke="#123" stroke-width="2.5" fill="none" stroke-linecap="round"/>
       <g fill="#bff6ff"><circle cx="120" cy="12" r="3"/><circle cx="129" cy="6" r="2"/><circle cx="111" cy="6" r="2"/></g>`,
      'deco-whale',
    ),
  earth: () =>
    svg(
      120,
      120,
      `<defs><clipPath id="ea"><circle cx="60" cy="60" r="56"/></clipPath></defs>
       <circle cx="60" cy="60" r="58" fill="none" stroke="#bff6ff" stroke-width="3" opacity=".5"/>
       <circle cx="60" cy="60" r="56" fill="#2e86de"/>
       <g clip-path="url(#ea)" fill="#5fc24a"><path d="M30 20 Q50 10 58 26 Q52 40 60 52 Q46 60 38 48 Q24 46 30 20Z"/>
       <path d="M70 60 Q92 54 100 70 Q96 92 80 104 Q72 90 74 78 Q64 70 70 60Z"/><path d="M8 70 Q20 66 26 80 Q18 92 6 88Z"/></g>
       <path d="M18 60 Q38 54 54 62 M66 34 Q82 28 98 36 M40 96 Q54 92 66 98" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>`,
      'deco-earth',
    ),
  shootingStar: () =>
    svg(
      172,
      80,
      `<g fill="none" stroke-width="6" stroke-linecap="round" opacity=".75"><path d="M4 22 Q70 34 130 38" stroke="#ff5d8f"/>
       <path d="M10 36 Q70 42 130 44" stroke="#ffd23f"/><path d="M4 52 Q70 52 130 50" stroke="#2ec4d6"/></g>
       <path transform="translate(118 18) scale(0.5)" d="${STAR_PATH}" fill="#ffd23f" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
       <circle cx="139" cy="44" r="2" fill="#7a4b2a"/><circle cx="149" cy="44" r="2" fill="#7a4b2a"/>
       <path d="M140 50 Q144 53 148 50" stroke="#7a4b2a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      'deco-shootingstar',
    ),
  sun: () => {
    const rays = Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      const p = (r: number, da: number) => `${(80 + r * Math.cos(a + da)).toFixed(1)} ${(80 + r * Math.sin(a + da)).toFixed(1)}`;
      return `M${p(54, -0.16)} L${p(78, 0)} L${p(54, 0.16)}Z`;
    }).join(' ');
    return svg(
      160,
      160,
      `<path d="${rays}" fill="#ffb627"/><circle cx="80" cy="80" r="52" fill="#ffd23f"/><circle cx="80" cy="80" r="44" fill="#ffe066"/>
       <circle cx="64" cy="74" r="5" fill="#7a4b2a"/><circle cx="96" cy="74" r="5" fill="#7a4b2a"/>
       <circle cx="56" cy="90" r="7" fill="#ff8fa3" opacity=".6"/><circle cx="104" cy="90" r="7" fill="#ff8fa3" opacity=".6"/>
       <path d="M64 92 Q80 106 96 92" stroke="#7a4b2a" stroke-width="4" fill="none" stroke-linecap="round"/>`,
      'deco-sun',
    );
  },
};

export const STAR_PATH =
  'M50 4 L62 36 L96 37 L69 58 L79 92 L50 72 L21 92 L31 58 L4 37 L38 36Z';

export const ROCKET = svg(
  120,
  200,
  `<path d="M60 6 C88 30 96 74 92 128 L28 128 C24 74 32 30 60 6Z" fill="#fdfdff"/>
   <path d="M60 6 C72 16 80 28 85 42 L35 42 C40 28 48 16 60 6Z" fill="#ff4d6d"/>
   <path d="M28 98 L6 146 L8 156 L32 132Z M92 98 L114 146 L112 156 L88 132Z" fill="#ff4d6d"/>
   <path d="M52 124 L68 124 L66 160 L54 160Z" fill="#ff4d6d"/>
   <rect x="34" y="128" width="52" height="12" rx="5" fill="#7a86b8"/>
   <path d="M86 46 C90 70 91 98 90 124" stroke="#d8def2" stroke-width="5" fill="none" stroke-linecap="round"/>
   <circle cx="60" cy="76" r="22" fill="#5fc3ff" stroke="#7a86b8" stroke-width="6"/>
   <g class="rocket-face">
     <circle cx="60" cy="80" r="13" fill="#ffd9b0"/>
     <path d="M47 76 Q50 62 60 64 Q70 62 73 76 Q67 70 60 71 Q53 70 47 76Z" fill="#6b3d1f"/>
     <circle cx="55" cy="80" r="2" fill="#2a1a12"/><circle cx="65" cy="80" r="2" fill="#2a1a12"/>
     <path d="M54 85 Q60 90 66 85" stroke="#2a1a12" stroke-width="2" fill="none" stroke-linecap="round"/>
     <circle cx="51" cy="85" r="2.4" fill="#ff8fa3" opacity=".7"/><circle cx="69" cy="85" r="2.4" fill="#ff8fa3" opacity=".7"/>
   </g>
   <ellipse cx="52" cy="68" rx="5" ry="8" fill="#fff" opacity=".5" transform="rotate(30 52 68)"/>`,
  'rocket-body',
);

export const FLAME = svg(
  60,
  90,
  `<path d="M30 0 C46 18 52 40 30 88 C8 40 14 18 30 0Z" fill="#ffb627"/>
   <path d="M30 6 C40 22 42 40 30 70 C18 40 20 22 30 6Z" fill="#fff1a8"/>`,
  'flame',
);

export const GROUND = `
  <svg class="ground-hills" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 70 Q150 20 320 55 T640 45 T960 30 T1200 60 V300 H0Z" fill="#a3e07f"/>
    <path d="M0 84 Q300 68 600 80 T1200 78 V300 H0Z" fill="#5fc24a"/>
    <path d="M0 150 Q300 130 600 145 T1200 140 V300 H0Z" fill="#52b13f"/>
  </svg>
  <div class="ground-props">
    ${svg(70, 90, `<rect x="31" y="56" width="8" height="32" fill="#8a5a2b"/><circle cx="35" cy="40" r="26" fill="#3fa83a"/><circle cx="24" cy="30" r="9" fill="#5fc24a"/>`, 'tree t1')}
    ${svg(70, 90, `<rect x="31" y="56" width="8" height="32" fill="#8a5a2b"/><circle cx="35" cy="40" r="26" fill="#34a050"/><circle cx="46" cy="32" r="8" fill="#5fc24a"/>`, 'tree t2')}
    ${svg(110, 100, `<rect x="14" y="44" width="82" height="54" fill="#fff4dd"/><path d="M4 48 L55 6 L106 48Z" fill="#ff6b5a"/><rect x="44" y="64" width="20" height="34" rx="3" fill="#a0632e"/><rect x="22" y="58" width="16" height="16" fill="#8fd6ff" stroke="#fff" stroke-width="3"/><rect x="72" y="58" width="16" height="16" fill="#8fd6ff" stroke="#fff" stroke-width="3"/>`, 'house')}
    ${svg(40, 40, `<circle cx="20" cy="14" r="6" fill="#ffd23f"/><g fill="#fff"><circle cx="20" cy="5" r="5"/><circle cx="29" cy="14" r="5"/><circle cx="20" cy="23" r="5"/><circle cx="11" cy="14" r="5"/></g><circle cx="20" cy="14" r="4" fill="#ffb627"/><path d="M20 28 V40" stroke="#3fa83a" stroke-width="3"/>`, 'flower f1')}
    ${svg(40, 40, `<g fill="#ff8fc7"><circle cx="20" cy="5" r="5"/><circle cx="29" cy="14" r="5"/><circle cx="20" cy="23" r="5"/><circle cx="11" cy="14" r="5"/></g><circle cx="20" cy="14" r="4" fill="#ffd23f"/><path d="M20 28 V40" stroke="#3fa83a" stroke-width="3"/>`, 'flower f2')}
    ${svg(160, 40, `<rect x="0" y="20" width="160" height="20" rx="6" fill="#7a86b8"/><rect x="10" y="10" width="140" height="14" rx="5" fill="#a9b3d9"/><path d="M20 24 L20 40 M140 24 L140 40" stroke="#5a6596" stroke-width="5"/>`, 'pad')}
  </div>`;

type Art = typeof ART;
type Plain = { [K in keyof Art]: Art[K] extends () => string ? K : never }[keyof Art];

/** The drawing for a scenery name from scenery.ts ("cloud", "planet3", "dragon"…). */
export function artSvg(name: string, size = 1): string {
  if (name === 'cloud') return ART.cloud(size);
  if (name.startsWith('planet')) return ART.planet(COLORS[Number(name.slice(6))]);
  return ART[name as Plain]();
}
