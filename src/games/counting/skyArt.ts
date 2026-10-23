/**
 * The counting game's drawings: the rocket, the ground and the scenery of the
 * sky. Procedural inline SVG, no asset files; scripts/export-ios-art.ts writes
 * the same drawings into the iOS app's asset catalog.
 */

export const COLORS = ['#ff5d8f', '#ffb627', '#2ec4d6', '#7bd35a', '#a374ff', '#ff8a3d'];

export const svg = (w: number, h: number, body: string, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${body}</svg>`;

/** Gradient stops: '#fff', or '#fff/0.5' with an opacity. */
const stops = (cs: string[]) =>
  cs
    .map((c, i) => {
      const [color, opacity = '1'] = c.split('/');
      return `<stop offset="${(i / (cs.length - 1)).toFixed(2)}" stop-color="${color}" stop-opacity="${opacity}"/>`;
    })
    .join('');
/** A linear gradient, top to bottom unless (x2, y2) say otherwise. */
const lin = (id: string, cs: string[], x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops(cs)}</linearGradient>`;
/** A radial gradient, lit from the top left by default. */
const rad = (id: string, cs: string[], cx = 0.35, cy = 0.3, r = 0.8) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(cs)}</radialGradient>`;
/** Light and shade over something round: a soft highlight top left, a darker rim. */
const SHADE = ['#ffffff/0.45', '#ffffff/0', '#0b1030/0.3'];

export const ART = {
  cloud: (s: number) =>
    svg(
      120,
      60,
      `<defs>${lin('clB', ['#ffffff', '#ffffff', '#e2efff'])}</defs>
       <g fill="url(#clB)"><circle cx="35" cy="35" r="20"/><circle cx="60" cy="25" r="24"/><circle cx="85" cy="36" r="18"/><rect x="20" y="34" width="82" height="22" rx="11"/></g>
       <path d="M24 50 Q60 60 100 50" stroke="#d6ecff" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      `deco-cloud s${s}`,
    ),
  bird: () =>
    svg(40, 20, `<path d="M2 12 Q10 2 20 12 Q30 2 38 12" stroke="#2a3550" stroke-width="3" fill="none" stroke-linecap="round"/>`, 'deco-bird'),
  planet: (c: string) =>
    svg(
      90,
      90,
      `<defs>${rad(`pl${c.slice(1)}`, SHADE, 0.32, 0.28, 0.75)}</defs>
       <circle cx="45" cy="45" r="40" fill="${c}"/><path d="M10 38 Q45 30 80 38 M8 54 Q45 62 82 54" stroke="#fff" stroke-width="5" opacity=".3" fill="none"/>
       <circle cx="45" cy="45" r="40" fill="url(#pl${c.slice(1)})"/>`,
      'deco-planet',
    ),
  comet: () =>
    svg(
      160,
      50,
      `<defs>${lin('coT', ['#bff6ff/0', '#bff6ff/0.9'], 1, 0)}${lin('coT2', ['#ffd6f5/0', '#ffd6f5/0.6'], 1, 0)}${rad('coH', ['#ffffff', '#e6fbff/0.9', '#9fe6ff/0'], 0.5, 0.5, 0.5)}</defs>
       <path d="M10 6 L138 22 L136 26 L4 14Z" fill="url(#coT2)"/><path d="M10 44 L138 28 L136 24 L4 36Z" fill="url(#coT2)"/>
       <path d="M0 17 L140 20 L140 30 L0 33Z" fill="url(#coT)"/>
       <circle cx="140" cy="25" r="18" fill="url(#coH)"/><circle cx="140" cy="25" r="8" fill="#fff"/>`,
      'deco-comet',
    ),

  // The friends the rocket meets every ten numbers (MILESTONES in scenery.ts).
  redBalloon: () =>
    svg(
      50,
      112,
      `<defs>${rad('rbB', ['#ffa3b5', '#ff4d6d', '#b5123f'], 0.35, 0.28, 0.85)}</defs>
       <path d="M25 66 Q19 78 27 88 Q34 98 25 110" stroke="#8a8fa8" stroke-width="1.5" fill="none"/>
       <path d="M22 62 L28 62 L26.5 66 L23.5 66Z" fill="#b5123f"/>
       <path d="M25 3 C40 3 47 17 46 31 C45 47 33 59 25 62 C17 59 5 47 4 31 C3 17 10 3 25 3Z" fill="url(#rbB)"/>
       <ellipse cx="15" cy="20" rx="4.5" ry="9" fill="#fff" opacity=".55" transform="rotate(-22 15 20)"/>
       <circle cx="18.5" cy="34" r="1.8" fill="#fff" opacity=".4"/>`,
      'deco-balloon',
    ),
  kite: () =>
    svg(
      80,
      122,
      `<defs>${lin('kiS', ['#ffffff/0.4', '#ffffff/0', '#000000/0.14'], 1, 1)}</defs>
       <path d="M40 86 Q28 96 42 104 Q56 112 40 120" stroke="#7a86b8" stroke-width="1.5" fill="none"/>
       <path d="M29 93 L35 96 L29 99Z M41 93 L35 96 L41 99Z" fill="#ff5d8f"/>
       <path d="M42 105 L48 108 L42 111Z M54 105 L48 108 L54 111Z" fill="#ffb627"/>
       <path d="M37 114 L43 117 L37 120Z M49 114 L43 117 L49 120Z" fill="#2ec4d6"/>
       <path d="M40 4 L10 34 L40 34Z" fill="#ff5d8f"/><path d="M40 4 L70 34 L40 34Z" fill="#ffb627"/>
       <path d="M10 34 L40 86 L40 34Z" fill="#2ec4d6"/><path d="M70 34 L40 86 L40 34Z" fill="#7bd35a"/>
       <path d="M40 4 L70 34 L40 86 L10 34Z" fill="url(#kiS)" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
       <path d="M40 5 V85 M11 34 H69" stroke="#7a4b2a" stroke-width="1.6" opacity=".55"/>`,
      'deco-kite',
    ),
  songbird: () =>
    svg(
      64,
      50,
      `<defs>${rad('sbB', ['#a8dcff', '#4fa3ff', '#2b6fd0'], 0.4, 0.3, 0.8)}${lin('sbW', ['#4a8ef0', '#1f4fa8'])}${lin('sbY', ['#fff6d0', '#ffc85a'])}</defs>
       <path d="M16 26 L1 14 L5 24 L0 30 L6 32 L2 38 L18 32Z" fill="url(#sbW)"/>
       <ellipse cx="30" cy="30" rx="20" ry="16" fill="url(#sbB)"/><ellipse cx="35" cy="36" rx="13" ry="8.5" fill="url(#sbY)"/>
       <circle cx="43" cy="21" r="12" fill="url(#sbB)"/><path d="M40 10 Q42 4 47 6 Q43 7 44 10Z" fill="#4fa3ff"/>
       <ellipse cx="39" cy="15" rx="4" ry="2.5" fill="#fff" opacity=".35"/>
       <path d="M18 27 Q22 6 40 20 Q36 26 30 30 Q24 31 18 27Z" fill="url(#sbW)"/>
       <path d="M24 24 Q28 16 34 20 M22 27 Q26 22 31 25" stroke="#a8dcff" stroke-width="1.2" fill="none" opacity=".7"/>
       <path d="M54 18 L63 22 L54 23Z" fill="#ffb627"/><path d="M54 23 L62 23 L54 27Z" fill="#f08a24"/>
       <circle cx="47" cy="18" r="3.2" fill="#1a2238"/><circle cx="48.1" cy="16.9" r="1.1" fill="#fff"/>
       <circle cx="45" cy="25" r="2.6" fill="#ff8fa3" opacity=".6"/>`,
      'deco-songbird',
    ),
  rcPlane: () =>
    svg(
      100,
      62,
      `<defs>${lin('rcF', ['#fff1a8', '#ffd23f', '#e0a800'])}${lin('rcW', ['#ff9fc0', '#e8467a'], 1, 1)}${lin('rcT', ['#6fe6f2', '#1fa3b4'])}${lin('rcC', ['#d8f6ff', '#3fa9e8'])}${rad('rcP', ['#ffffff/0.9', '#cfd8ff/0.5', '#cfd8ff/0'], 0.5, 0.5, 0.5)}</defs>
       <path d="M40 29 L28 4 L42 4 L56 29Z" fill="#d93a6b"/><path d="M18 27 L10 7 L22 7 L31 27Z" fill="url(#rcT)"/>
       <path d="M12 30 L4 24 L16 24 L24 30Z" fill="#1fa3b4"/>
       <path d="M12 32 Q12 24 22 24 L78 24 Q86 24 88 32 Q86 40 78 40 L22 40 Q12 40 12 32Z" fill="url(#rcF)"/>
       <rect x="16" y="31" width="68" height="3" fill="#ff5d8f"/><path d="M84 25 Q93 32 84 39Z" fill="#f08a24"/>
       <path d="M56 24 Q62 13 74 24Z" fill="url(#rcC)"/><path d="M60 22 Q63 17 67 19" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8"/>
       <circle cx="40" cy="32" r="5" fill="#fff"/><path transform="translate(36.5 28.6) scale(0.07)" d="${STAR_PATH}" fill="#ff5d8f"/>
       <path d="M40 35 L28 60 L42 60 L57 35Z" fill="url(#rcW)"/><path d="M42 37 L32 58" stroke="#fff" stroke-width="1.5" opacity=".35"/>
       <path d="M24 24 L19 11" stroke="#555" stroke-width="1.5"/><circle cx="19" cy="11" r="1.8" fill="#ff5d8f"/>
       <rect x="88" y="30" width="5" height="4" fill="#555"/><ellipse cx="94" cy="32" rx="4" ry="16" fill="url(#rcP)"/>
       <path d="M88 29 Q95 32 88 35Z" fill="#ff5d8f"/>`,
      'deco-rcplane',
    ),
  eagle: () =>
    svg(
      160,
      92,
      `<defs>${lin('eaW', ['#b9844c', '#7a4b22', '#4e2a10'])}${rad('eaB', ['#9a6a3a', '#5e3518'], 0.4, 0.3, 0.8)}${rad('eaH', ['#ffffff', '#ffffff', '#d9deea'], 0.35, 0.3, 0.8)}${lin('eaK', ['#ffe066', '#f08a24'])}${lin('eaT', ['#ffffff', '#d6dbe8'])}</defs>
       <path d="M78 44 C60 18 30 10 2 16 L14 24 L6 30 L20 34 L12 42 L30 44 Q50 52 78 56Z" fill="url(#eaW)"/>
       <path d="M82 44 C100 18 130 10 158 16 L146 24 L154 30 L140 34 L148 42 L130 44 Q110 52 82 56Z" fill="url(#eaW)"/>
       <path d="M72 40 Q52 24 22 20 M68 47 Q50 38 30 37 M88 40 Q108 24 138 20 M92 47 Q110 38 130 37" stroke="#e0b07a" stroke-width="1.8" fill="none" opacity=".55" stroke-linecap="round"/>
       <path d="M70 70 L73 88 L80 84 L87 88 L90 70Z" fill="url(#eaT)"/>
       <path d="M72 69 Q70 76 74 78 M88 69 Q90 76 86 78" stroke="#ffb627" stroke-width="3" fill="none" stroke-linecap="round"/>
       <ellipse cx="80" cy="54" rx="14" ry="20" fill="url(#eaB)"/>
       <circle cx="86" cy="32" r="12" fill="url(#eaH)"/><path d="M95 28 Q108 30 102 40 Q99 37 96 36Z" fill="url(#eaK)"/>
       <path d="M85 25.5 L92 27" stroke="#9aa3b8" stroke-width="1.5" stroke-linecap="round"/>
       <circle cx="89" cy="29.5" r="2.4" fill="#1a2238"/><circle cx="89.8" cy="28.7" r=".8" fill="#fff"/>`,
      'deco-eagle',
    ),
  hotAir: () =>
    svg(
      90,
      120,
      `<defs>${rad('haS', SHADE, 0.32, 0.25, 0.85)}${lin('haB', ['#d39557', '#8a5426'])}</defs>
       <path d="M36 84 L38 98 M54 84 L52 98 M45 84 V98" stroke="#7a4b2a" stroke-width="1.5"/>
       <path d="M45 4 C10 4 4 40 20 62 L34 84 L56 84 L70 62 C86 40 80 4 45 4Z" fill="#ff5d8f"/>
       <path d="M45 4 C24 4 20 40 30 62 L38 84 L52 84 L60 62 C70 40 66 4 45 4Z" fill="#ffd23f"/>
       <path d="M45 4 C36 4 34 40 38 62 L42 84 L48 84 L52 62 C56 40 54 4 45 4Z" fill="#2ec4d6"/>
       <path d="M45 4 C10 4 4 40 20 62 L34 84 L56 84 L70 62 C86 40 80 4 45 4Z" fill="url(#haS)"/>
       <path d="M25 70 Q45 76 65 70 L56 84 L34 84Z" fill="#c93a6a"/>
       <path d="M45 85 Q49 90 45 95 Q41 90 45 85Z" fill="#ffb627"/>
       <rect x="34" y="98" width="22" height="16" rx="3" fill="url(#haB)"/>
       <path d="M34 103.5 H56 M34 109 H56 M40 98 V114 M45 98 V114 M50 98 V114" stroke="#6b3d1f" stroke-width="1" opacity=".45"/>
       <rect x="32" y="96" width="26" height="4" rx="2" fill="#6b3d1f"/>`,
      'deco-hotair',
    ),
  cessna: () =>
    svg(
      150,
      70,
      `<defs>${lin('ceF', ['#ffffff', '#eef2fb', '#c3cce3'])}${lin('ceT', ['#ff8fb0', '#e8467a'])}${lin('ceG', ['#e0f7ff', '#5fb7ef'])}${lin('ceW', ['#ffffff', '#cdd6ec'])}${rad('ceP', ['#ffffff/0.9', '#cfd8ff/0.5', '#cfd8ff/0'], 0.5, 0.5, 0.5)}</defs>
       <path d="M14 34 L6 10 L22 10 L36 28Z" fill="url(#ceT)"/><path d="M10 33 L2 28 L16 28 L24 33Z" fill="#c93a6a"/>
       <path d="M100 46 V54 M50 44 V51" stroke="#556" stroke-width="2.5"/>
       <circle cx="100" cy="58" r="5" fill="#2a2f45"/><circle cx="100" cy="58" r="2" fill="#9aa6c8"/>
       <circle cx="50" cy="55" r="4" fill="#2a2f45"/><circle cx="50" cy="55" r="1.6" fill="#9aa6c8"/>
       <path d="M12 34 Q14 26 30 26 L112 24 Q132 26 136 36 Q132 46 112 46 L40 44 Q20 42 12 34Z" fill="url(#ceF)"/>
       <path d="M18 37 L133 36 L132 39.5 L20 40.5Z" fill="#2e86de"/><path d="M22 42.6 L128 42" stroke="#ff5d8f" stroke-width="1.2"/>
       <rect x="78" y="27" width="16" height="14" rx="2" fill="none" stroke="#b8c2dc" stroke-width="1"/>
       <rect x="80" y="28" width="12" height="7" rx="2" fill="url(#ceG)"/><rect x="96" y="28" width="14" height="7" rx="2" fill="url(#ceG)"/>
       <path d="M98 33 L101 29 M82 33 L85 29" stroke="#fff" stroke-width="1.2" opacity=".8"/>
       <path d="M24 28 Q70 25 120 25" stroke="#fff" stroke-width="1.5" fill="none" opacity=".9"/>
       <rect x="56" y="16" width="62" height="8" rx="4" fill="url(#ceW)"/><path d="M76 24 L86 40" stroke="#9aa6c8" stroke-width="2"/>
       <path d="M128 28 Q136 30 137 36 Q136 42 128 44Z" fill="#dfe6f5"/>
       <circle cx="137" cy="36" r="4" fill="#ff5d8f"/><ellipse cx="141" cy="36" rx="4" ry="18" fill="url(#ceP)"/>`,
      'deco-cessna',
    ),
  helicopter: () =>
    svg(
      140,
      80,
      `<defs>${lin('heB', ['#ffa3c0', '#ff5d8f', '#c9306a'])}${lin('heG', ['#effcff', '#7fd3f5'], 1, 1)}${lin('heR', ['#555566/0', '#555566/0.45', '#555566/0'], 1, 0)}</defs>
       <ellipse cx="65" cy="6" rx="62" ry="3.5" fill="url(#heR)"/><rect x="14" y="4" width="102" height="3.5" rx="1.75" fill="#4a5070"/>
       <rect x="62" y="6" width="6" height="13" fill="#4a5070"/><circle cx="65" cy="6" r="3" fill="#2a2f45"/>
       <path d="M44 42 L8 34 L8 42 L46 52Z" fill="url(#heB)"/><path d="M4 30 L10 20 L15 36Z" fill="#c9306a"/>
       <circle cx="9" cy="37" r="9" fill="#556" opacity=".12"/><path d="M9 28 V46" stroke="#4a5070" stroke-width="2"/>
       <path d="M54 62 V72 M92 62 V72" stroke="#4a5070" stroke-width="3"/>
       <path d="M40 74 H106 Q110 74 111 70" stroke="#4a5070" stroke-width="4" fill="none" stroke-linecap="round"/>
       <path d="M40 48 Q40 18 72 18 Q104 18 108 46 Q106 62 80 62 L52 62 Q40 60 40 48Z" fill="url(#heB)"/>
       <path d="M84 22 Q102 24 104 44 L84 44Z" fill="url(#heG)"/><path d="M89 26 Q98 28 100 37" stroke="#fff" stroke-width="2" fill="none" opacity=".75"/>
       <path d="M58 26 H76 V54 H58Z" fill="none" stroke="#b02a5e" stroke-width="1.2" opacity=".6"/>
       <rect x="61" y="29" width="12" height="10" rx="2" fill="url(#heG)"/>
       <path d="M46 56 H102" stroke="#ffd23f" stroke-width="3"/>
       <path d="M48 36 Q52 24 66 21" stroke="#fff" stroke-width="3" fill="none" opacity=".45" stroke-linecap="round"/>`,
      'deco-helicopter',
    ),
  dragon: () =>
    svg(
      172,
      112,
      `<defs>${lin('drB', ['#9be887', '#5fc24a', '#3a9333'])}${lin('drW', ['#8be9f3', '#2ec4d6', '#1a8fa6'], 1, 1)}${lin('drY', ['#fff4c2', '#ffd66b'])}${lin('drF', ['#fff1a8', '#ffb627', '#ff6b3d'], 1, 0)}${lin('drH', ['#fff1a8', '#ffb627'])}</defs>
       <path d="M42 70 Q14 74 8 96 Q6 104 16 100 L12 108 L24 100 Q22 84 48 80Z" fill="url(#drB)"/>
       <path d="M70 54 Q72 22 104 12 Q96 28 106 34 Q92 38 98 48Z" fill="#1a8fa6" opacity=".85"/>
       <path d="M44 58 L48 48 L54 56 L58 46 L64 54 L68 46 L72 54Z" fill="url(#drH)"/>
       <path d="M60 86 L56 98 L66 97Z M84 86 L84 98 L93 95Z" fill="#3a9333"/>
       <ellipse cx="70" cy="70" rx="34" ry="20" fill="url(#drB)"/><ellipse cx="74" cy="78" rx="24" ry="10" fill="url(#drY)"/>
       <path d="M60 72 Q61 80 63 86 M69 70 Q70 80 70 88 M78 70 Q78 80 78 88 M87 71 Q86 80 85 86" stroke="#e0b44a" stroke-width="1.2" fill="none" opacity=".7"/>
       <path d="M50 60 Q64 51 84 54" stroke="#d4f7c2" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>
       <path d="M92 64 Q110 40 124 38 Q140 34 150 42 Q157 50 148 56 Q138 60 124 56 Q112 62 102 78Z" fill="url(#drB)"/>
       <path d="M122 38 L117 22 L128 34Z M131 35 L134 20 L139 36Z" fill="url(#drH)"/>
       <path d="M62 56 Q58 14 96 4 Q88 24 100 30 Q84 34 92 46 Q80 46 80 58Z" fill="url(#drW)"/>
       <path d="M64 54 Q70 24 95 6 M70 54 Q82 34 98 30 M75 56 Q84 46 91 46" stroke="#e6fbff" stroke-width="1.3" fill="none" opacity=".6"/>
       <circle cx="132" cy="44" r="5.5" fill="#fff"/><circle cx="133.5" cy="44" r="2.8" fill="#1a2238"/><circle cx="134.6" cy="42.8" r="1" fill="#fff"/>
       <circle cx="140" cy="51" r="3" fill="#ff8fa3" opacity=".55"/>
       <circle cx="150" cy="46" r="1.8" fill="#2f7d32"/><path d="M137 52 Q143 56 149 52" stroke="#2f7d32" stroke-width="2" fill="none" stroke-linecap="round"/>
       <path d="M156 48 Q168 38 172 48 Q168 58 156 52Z" fill="url(#drF)"/><path d="M157 49 Q163 45 166 49 Q163 52 157 51Z" fill="#fff6c4"/>`,
      'deco-dragon',
    ),
  plane: () =>
    svg(
      150,
      60,
      `<defs>${lin('plF', ['#ffffff', '#eef2fb', '#c3cce3'])}${lin('plW', ['#6fe6f2', '#1fa3b4'])}${lin('plT', ['#ff8fb0', '#e8467a'])}</defs>
       <path d="M72 26 L50 2 L64 2 L94 26Z" fill="#1a8fa0"/>
       <path d="M14 30 L6 8 L20 8 L32 24Z" fill="url(#plT)"/><circle cx="17" cy="16" r="3.5" fill="#fff" opacity=".85"/>
       <path d="M10 28 L2 22 L14 22 L22 28Z" fill="#c9306a"/>
       <path d="M10 32 Q12 22 30 22 L118 22 Q140 24 144 32 Q140 40 118 42 L30 42 Q12 42 10 32Z" fill="url(#plF)"/>
       <path d="M24 24 Q80 21.5 124 23.5" stroke="#fff" stroke-width="2" fill="none"/>
       <path d="M16 36 L139 35" stroke="#2e86de" stroke-width="2.5"/>
       <g fill="#4a6fd8">${Array.from({ length: 9 }, (_, i) => `<rect x="${44 + i * 7}" y="27" width="4" height="5" rx="1.5"/>`).join('')}</g>
       <rect x="112" y="26" width="6" height="10" rx="1.5" fill="none" stroke="#b8c2dc" stroke-width="1"/>
       <path d="M126 27 Q133 27 137 31 L127 31Z" fill="#2a3550"/>
       <path d="M72 38 L52 58 L66 58 L96 38Z" fill="url(#plW)"/>
       <rect x="62" y="42" width="18" height="7" rx="3.5" fill="#dfe6f5" stroke="#9aa6c8" stroke-width="1"/>
       <ellipse cx="80" cy="45.5" rx="1.6" ry="3.2" fill="#2a3550"/>`,
      'deco-plane',
    ),
  zeppelin: () =>
    svg(
      180,
      78,
      `<defs>${lin('zeB', ['#f6f8ff', '#ccd5ff', '#8e9ae0'])}${lin('zeF', ['#c9adff', '#7d4fe0'])}${lin('zeG', ['#a7b2e0', '#5a6596'])}</defs>
       <path d="M22 30 L4 6 L28 16Z M22 38 L4 62 L28 52Z" fill="url(#zeF)"/>
       <ellipse cx="94" cy="34" rx="80" ry="28" fill="url(#zeB)"/>
       <path d="M54 10 Q46 34 54 58 M94 6 V62 M134 10 Q142 34 134 58" stroke="#a7b2ea" stroke-width="1.2" fill="none" opacity=".8"/>
       <ellipse cx="94" cy="36" rx="80" ry="7" fill="#a374ff" opacity=".45"/>
       <ellipse cx="82" cy="17" rx="46" ry="5" fill="#fff" opacity=".6"/>
       <path d="M86 61 V58 M102 61 V58" stroke="#5a6596" stroke-width="2"/>
       <rect x="78" y="60" width="32" height="12" rx="5" fill="url(#zeG)"/>
       <g fill="#ffd23f"><circle cx="86" cy="66" r="2.5"/><circle cx="94" cy="66" r="2.5"/><circle cx="102" cy="66" r="2.5"/></g>
       <path d="M110 66 H116" stroke="#5a6596" stroke-width="2"/><ellipse cx="117" cy="66" rx="1.6" ry="6" fill="#cfd8ff" opacity=".85"/>`,
      'deco-zeppelin',
    ),
  jets: () => {
    const jet = (x: number, y: number, trail: string, id: string) =>
      `<defs>${lin(id, [`${trail}/0`, `${trail}/0.85`], 1, 0)}</defs>
       <rect x="0" y="${y + 3}" width="${x + 4}" height="8" rx="4" fill="url(#${id})"/>
       <g transform="translate(${x} ${y})"><path d="M2 6 L-2 -3 L4 -3 L9 5Z" fill="#2e86de"/>
       <path d="M0 7 Q2 3 8 3 L30 4 Q38 6 38 7 Q38 8 30 10 L8 11 Q2 11 0 7Z" fill="url(#jtB)"/>
       <path d="M32 4.4 Q38 6 38 7 Q38 8 32 9.6Z" fill="#ff5d8f"/>
       <path d="M14 8 L8 18 L14 18 L24 8Z" fill="#2e86de"/><ellipse cx="25" cy="5.6" rx="4.5" ry="2.2" fill="url(#jtC)"/></g>`;
    return svg(
      170,
      92,
      `<defs>${lin('jtB', ['#ffffff', '#c9d2e8'])}${lin('jtC', ['#e6fbff', '#3fa9e8'])}</defs>` +
        jet(108, 10, '#ff5d8f', 'jt1') +
        jet(130, 40, '#ffd23f', 'jt2') +
        jet(108, 70, '#2ec4d6', 'jt3'),
      'deco-jets',
    );
  },
  weatherBalloon: () =>
    svg(
      80,
      146,
      `<defs>${rad('wbB', ['#ffffff', '#eef2ff', '#b9c6f0'], 0.35, 0.3, 0.8)}${lin('wbX', ['#ffb36b', '#e06a1a'])}</defs>
       <path d="M40 80 V100 M31 104 L38 128 M49 104 L42 128" stroke="#888" stroke-width="1"/>
       <path d="M29 104 Q40 92 51 104Z" fill="#ff5d8f"/><path d="M37 104 Q40 93 43 104Z" fill="#fff"/>
       <path d="M34 74 L46 74 L40 82Z" fill="#dfe6ff"/>
       <circle cx="40" cy="40" r="36" fill="url(#wbB)"/>
       <ellipse cx="27" cy="25" rx="7" ry="11" fill="#fff" opacity=".85" transform="rotate(-20 27 25)"/>
       <rect x="30" y="128" width="20" height="14" rx="2" fill="url(#wbX)"/><rect x="33" y="132" width="14" height="4" rx="1" fill="#fff" opacity=".8"/>
       <path d="M50 131 L60 121" stroke="#555" stroke-width="2"/><circle cx="60" cy="121" r="2.5" fill="#ff5d8f"/>`,
      'deco-weatherballoon',
    ),
  carpet: () =>
    svg(
      150,
      70,
      `<defs>${lin('caB', ['#c9adff', '#8a4fe0'])}</defs>
       <path d="M12 40 L3 37 M12 46 L3 46 M12 52 L3 55 M138 40 L147 37 M138 46 L147 46 M138 52 L147 55" stroke="#ffd23f" stroke-width="2.5" stroke-linecap="round"/>
       <g fill="#ff8a3d"><circle cx="3" cy="37" r="2.4"/><circle cx="3" cy="46" r="2.4"/><circle cx="3" cy="55" r="2.4"/><circle cx="147" cy="37" r="2.4"/><circle cx="147" cy="46" r="2.4"/><circle cx="147" cy="55" r="2.4"/></g>
       <path d="M12 40 Q42 26 75 40 T138 40 L138 52 Q108 66 75 52 T12 52Z" fill="url(#caB)" stroke="#ffd23f" stroke-width="3" stroke-linejoin="round"/>
       <path d="M18 43.5 Q44 31 75 43.5 T132 43.5 M132 48.5 Q108 61 75 48.5 T18 48.5" stroke="#ffd23f" stroke-width="1" fill="none" opacity=".75"/>
       <ellipse cx="75" cy="46" rx="12" ry="4.5" fill="#ffd23f"/><ellipse cx="75" cy="46" rx="6" ry="2.2" fill="#ff5d8f"/>
       <g fill="#ffb627"><path d="M40 42 L44 38.5 L48 42 L44 45.5Z"/><path d="M102 50 L106 46.5 L110 50 L106 53.5Z"/></g>
       <g fill="#2ec4d6"><circle cx="30" cy="46" r="1.8"/><circle cx="58" cy="44" r="1.8"/><circle cx="92" cy="48" r="1.8"/><circle cx="120" cy="47" r="1.8"/></g>`,
      'deco-carpet',
    ),
  shuttle: () =>
    svg(
      90,
      140,
      `<defs>${lin('shB', ['#c3cce3', '#ffffff', '#d5dcef'], 1, 0)}${lin('shF', ['#fff6c4', '#ffb627', '#ff6b3d/0'])}</defs>
       <ellipse cx="38" cy="127" rx="5" ry="13" fill="url(#shF)"/><ellipse cx="52" cy="127" rx="5" ry="13" fill="url(#shF)"/>
       <path d="M33 110 H43 L44.5 118 H31.5Z M47 110 H57 L58.5 118 H45.5Z" fill="#5a6596"/>
       <path d="M32 66 L6 110 L32 110Z M58 66 L84 110 L58 110Z" fill="url(#shB)" stroke="#b8c2dc" stroke-width="1"/>
       <path d="M6 110 L12 100 L32 100 L32 110Z M84 110 L78 100 L58 100 L58 110Z" fill="#2a3550"/>
       <path d="M45 4 Q58 16 58 40 L58 110 L32 110 L32 40 Q32 16 45 4Z" fill="url(#shB)"/>
       <path d="M45 4 Q54 12 56 24 L34 24 Q36 12 45 4Z" fill="#2a3550"/>
       <rect x="38" y="30" width="14" height="6" rx="2" fill="#2a3550"/><path d="M40 34 L42 31.5 M46 34 L48 31.5" stroke="#9fc1ff" stroke-width="1"/>
       <path d="M37 44 H53 M37 92 H53" stroke="#c9d2e8" stroke-width="1"/>
       <rect x="32" y="56" width="26" height="4" fill="#ff5d8f"/><circle cx="45" cy="76" r="4" fill="#2e86de"/>`,
      'deco-shuttle',
    ),
  satellite: () =>
    svg(
      120,
      60,
      `<defs>${lin('saP', ['#6b93ef', '#2a4fb0'], 1, 1)}${lin('saG', ['#fff1a8', '#ffcf3f', '#d49a17'], 1, 1)}</defs>
       <path d="M40 30 H80" stroke="#b8c2dc" stroke-width="3"/>
       <g fill="url(#saP)" stroke="#9fc1ff" stroke-width="2"><rect x="2" y="18" width="38" height="24"/><rect x="80" y="18" width="38" height="24"/></g>
       <path d="M2 26 H40 M2 34 H40 M15 18 V42 M28 18 V42 M80 26 H118 M80 34 H118 M93 18 V42 M106 18 V42" stroke="#9fc1ff" stroke-width="1" opacity=".6"/>
       <rect x="48" y="14" width="24" height="32" rx="4" fill="url(#saG)"/>
       <path d="M52 22 L58 26 L54 33 M67 19 L62 29 L68 38" stroke="#fff6c4" stroke-width="1" fill="none" opacity=".8"/>
       <path d="M60 14 V8" stroke="#9aa6c8" stroke-width="1.5"/><path d="M51 9 Q60 15 69 9Z" fill="#e8e8f0" stroke="#b8c2dc" stroke-width="1"/>
       <path d="M60 10 V3" stroke="#9aa6c8" stroke-width="1.2"/><circle cx="60" cy="3" r="2" fill="#ff5d8f"/>`,
      'deco-satellite',
    ),
  station: () =>
    svg(
      170,
      98,
      `<defs>${lin('stP', ['#6b93ef', '#2a4fb0'], 1, 1)}${lin('stM', ['#ffffff', '#dfe4f2', '#b4bdd8'])}${lin('stV', ['#ffffff', '#dfe4f2', '#b4bdd8'], 1, 0)}</defs>
       <rect x="4" y="46" width="162" height="6" fill="#c9d3ff"/><path d="M4 49 H166" stroke="#9aa6c8" stroke-width="1"/>
       <g fill="url(#stP)" stroke="#9fc1ff" stroke-width="2"><rect x="10" y="8" width="26" height="36"/><rect x="10" y="54" width="26" height="36"/>
       <rect x="134" y="8" width="26" height="36"/><rect x="134" y="54" width="26" height="36"/></g>
       <path d="M10 20 H36 M10 32 H36 M23 8 V44 M10 66 H36 M10 78 H36 M23 54 V90 M134 20 H160 M134 32 H160 M147 8 V44 M134 66 H160 M134 78 H160 M147 54 V90" stroke="#9fc1ff" stroke-width="1" opacity=".55"/>
       <rect x="46" y="56" width="10" height="24" fill="#fff" opacity=".85"/><rect x="114" y="18" width="10" height="24" fill="#fff" opacity=".85"/>
       <rect x="62" y="38" width="46" height="22" rx="8" fill="url(#stM)"/><rect x="76" y="22" width="18" height="54" rx="6" fill="url(#stV)"/>
       <circle cx="85" cy="49" r="6" fill="#5fc3ff"/><circle cx="83.5" cy="47.5" r="2" fill="#fff" opacity=".7"/>
       <circle cx="85" cy="18" r="3" fill="#ff5d8f"/>`,
      'deco-station',
    ),
  astronaut: () =>
    svg(
      90,
      110,
      `<defs>${lin('asS', ['#ffffff', '#e6eaf7', '#b9c3e0'], 1, 1)}${rad('asV', ['#8aa8ff', '#2b3a7a', '#141c44'], 0.35, 0.3, 0.8)}</defs>
       <rect x="20" y="40" width="50" height="40" rx="10" fill="#c9d2e8"/>
       <rect x="8" y="48" width="20" height="12" rx="6" fill="url(#asS)" transform="rotate(-30 18 54)"/>
       <rect x="62" y="48" width="20" height="12" rx="6" fill="url(#asS)" transform="rotate(30 72 54)"/>
       <circle cx="9.5" cy="59" r="5.5" fill="#ff8a3d"/><circle cx="80.5" cy="59" r="5.5" fill="#ff8a3d"/>
       <rect x="28" y="84" width="14" height="22" rx="6" fill="url(#asS)"/><rect x="48" y="84" width="14" height="22" rx="6" fill="url(#asS)"/>
       <rect x="27" y="100" width="16" height="7" rx="3" fill="#9aa6c8"/><rect x="47" y="100" width="16" height="7" rx="3" fill="#9aa6c8"/>
       <rect x="24" y="44" width="42" height="44" rx="14" fill="url(#asS)"/>
       <rect x="30" y="54" width="18" height="12" rx="3" fill="#ff5d8f"/><circle cx="56" cy="57" r="2.5" fill="#2ec4d6"/><circle cx="56" cy="64" r="2.5" fill="#ffd23f"/>
       <rect x="24" y="76" width="42" height="5" fill="#b9c3e0"/>
       <rect x="19" y="23" width="5" height="10" rx="2" fill="#c9d2e8"/><rect x="66" y="23" width="5" height="10" rx="2" fill="#c9d2e8"/>
       <circle cx="45" cy="28" r="24" fill="url(#asS)"/><circle cx="45" cy="28" r="17" fill="url(#asV)"/>
       <path d="M34 22 Q38 15 47 14" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7" stroke-linecap="round"/>
       <circle cx="54" cy="36" r="1.6" fill="#fff" opacity=".5"/>`,
      'deco-astronaut',
    ),
  moon: () => {
    const crater = (x: number, y: number, r: number) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#e3c574"/><circle cx="${x - r * 0.15}" cy="${y - r * 0.15}" r="${r * 0.82}" fill="#f0d993"/>`;
    return svg(
      140,
      140,
      `<defs>${rad('moB', ['#fffbe6', '#fff0b8', '#ecd084'], 0.38, 0.32, 0.8)}</defs>
       <circle cx="70" cy="70" r="62" fill="url(#moB)"/>
       ${crater(48, 52, 11)}${crater(90, 88, 15)}${crater(92, 44, 7)}${crater(52, 96, 6)}${crater(30, 78, 4)}
       <path d="M52 74 Q70 88 88 72" stroke="#c9a65a" stroke-width="3" fill="none" stroke-linecap="round"/>
       <circle cx="56" cy="64" r="3" fill="#c9a65a"/><circle cx="84" cy="62" r="3" fill="#c9a65a"/>
       <circle cx="48" cy="76" r="4" fill="#ffb3a3" opacity=".45"/><circle cx="92" cy="74" r="4" fill="#ffb3a3" opacity=".45"/>`,
      'deco-moon',
    );
  },
  ufo: () =>
    svg(
      110,
      60,
      `<defs>${lin('ufD', ['#f2fdff/0.95', '#9fe6ff/0.8'])}${lin('ufS', ['#d2bfff', '#a374ff', '#6b3fd0'])}${rad('ufL', ['#fff6c4', '#ffd23f/0.6', '#ffb627/0'], 0.5, 0.5, 0.5)}</defs>
       <circle cx="55" cy="26" r="8" fill="#7bd35a"/><circle cx="52" cy="24" r="1.6" fill="#123"/><circle cx="58" cy="24" r="1.6" fill="#123"/>
       <ellipse cx="55" cy="26" rx="22" ry="18" fill="url(#ufD)"/>
       <path d="M41 20 Q45 11 54 10" stroke="#fff" stroke-width="2" fill="none" opacity=".85" stroke-linecap="round"/>
       <ellipse cx="55" cy="44" rx="32" ry="7" fill="#4a2a9a" opacity=".6"/>
       <ellipse cx="55" cy="38" rx="52" ry="12" fill="url(#ufS)"/>
       <ellipse cx="55" cy="33" rx="30" ry="4" fill="#8a5cf0"/>
       <g fill="url(#ufL)"><circle cx="22" cy="40" r="8"/><circle cx="42" cy="44" r="8"/><circle cx="68" cy="44" r="8"/><circle cx="88" cy="40" r="8"/></g>
       <g fill="#ffe680"><circle cx="22" cy="40" r="3.5"/><circle cx="42" cy="44" r="3.5"/><circle cx="68" cy="44" r="3.5"/><circle cx="88" cy="40" r="3.5"/></g>`,
      'deco-ufo',
    ),
  mars: () =>
    svg(
      100,
      100,
      `<defs>${rad('maB', ['#ffa57a', '#e8673c', '#a8361c'], 0.35, 0.3, 0.8)}</defs>
       <circle cx="50" cy="50" r="46" fill="url(#maB)"/>
       <path d="M12 42 Q50 30 88 44 M8 62 Q42 72 90 58" stroke="#b8442a" stroke-width="7" fill="none" opacity=".5"/>
       <path d="M36 9 Q50 3 64 9 Q50 15 36 9Z" fill="#fff" opacity=".9"/>
       <circle cx="34" cy="76" r="6" fill="#b8442a" opacity=".6"/><circle cx="33" cy="75" r="4.5" fill="#f08a5d" opacity=".6"/>
       <circle cx="70" cy="28" r="4" fill="#b8442a" opacity=".6"/><circle cx="62" cy="62" r="3" fill="#b8442a" opacity=".5"/>
       <circle cx="34" cy="30" r="12" fill="#fff" opacity=".18"/>`,
      'deco-mars',
    ),
  saturn: () =>
    svg(
      200,
      120,
      `<defs>${rad('stB', ['#ffe4ad', '#ffc46b', '#d9893a'], 0.35, 0.3, 0.8)}${lin('stR', ['#fff3d6', '#e8c88a', '#c9a060'])}<clipPath id="stC"><circle cx="100" cy="60" r="42"/></clipPath></defs>
       <g transform="rotate(-12 100 62)"><ellipse cx="100" cy="62" rx="94" ry="20" fill="none" stroke="url(#stR)" stroke-width="9"/>
       <ellipse cx="100" cy="62" rx="80" ry="15" fill="none" stroke="#f5dfae" stroke-width="3" opacity=".6"/>
       <circle cx="100" cy="60" r="42" fill="url(#stB)"/>
       <g clip-path="url(#stC)"><path d="M50 46 Q100 38 150 46 M48 62 Q100 54 152 62 M52 76 Q100 70 148 76" stroke="#e8954a" stroke-width="5" fill="none" opacity=".7"/></g>
       <path d="M6 62 A94 20 0 0 0 194 62" fill="none" stroke="url(#stR)" stroke-width="9"/>
       <path d="M20 62 A80 15 0 0 0 180 62" fill="none" stroke="#f5dfae" stroke-width="3" opacity=".6"/></g>`,
      'deco-saturn',
    ),
  alien: () =>
    svg(
      100,
      116,
      `<defs>${rad('alH', ['#c2f5a0', '#7bd35a', '#4ea83a'], 0.38, 0.3, 0.8)}${lin('alS', ['#c9adff', '#8a5cf0'])}${rad('alG', ['#fff6c4', '#ffd23f', '#ffd23f/0'], 0.5, 0.5, 0.5)}</defs>
       <path d="M38 20 L30 6 M62 20 L70 6" stroke="#5fc24a" stroke-width="3"/>
       <circle cx="30" cy="5" r="5" fill="url(#alG)"/><circle cx="70" cy="5" r="5" fill="url(#alG)"/>
       <path d="M66 64 Q84 60 88 42 M34 64 Q22 74 20 88" stroke="#6cc94c" stroke-width="8" fill="none" stroke-linecap="round"/>
       <circle cx="88" cy="38" r="6" fill="#7bd35a"/>
       <rect x="36" y="90" width="10" height="20" rx="5" fill="#6cc94c"/><rect x="54" y="90" width="10" height="20" rx="5" fill="#6cc94c"/>
       <path d="M34 58 Q50 54 66 58 L70 94 Q50 100 30 94Z" fill="url(#alS)"/><circle cx="50" cy="74" r="5" fill="#ffd23f"/>
       <ellipse cx="50" cy="36" rx="28" ry="24" fill="url(#alH)"/>
       <ellipse cx="40" cy="34" rx="7" ry="9" fill="#fff"/><ellipse cx="60" cy="34" rx="7" ry="9" fill="#fff"/>
       <circle cx="41" cy="36" r="3.5" fill="#123"/><circle cx="61" cy="36" r="3.5" fill="#123"/>
       <circle cx="42.2" cy="34.6" r="1.2" fill="#fff"/><circle cx="62.2" cy="34.6" r="1.2" fill="#fff"/>
       <circle cx="34" cy="45" r="3" fill="#ff8fa3" opacity=".5"/><circle cx="66" cy="45" r="3" fill="#ff8fa3" opacity=".5"/>
       <path d="M42 48 Q50 54 58 48" stroke="#2f7d32" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
      'deco-alien',
    ),
  jupiter: () =>
    svg(
      120,
      120,
      `<defs><clipPath id="jp"><circle cx="60" cy="60" r="56"/></clipPath>${rad('jpS', SHADE, 0.32, 0.28, 0.8)}</defs>
       <circle cx="60" cy="60" r="56" fill="#ecc89c"/>
       <g clip-path="url(#jp)"><rect y="14" width="120" height="10" fill="#c98a5a"/><rect y="34" width="120" height="12" fill="#b8704a"/>
       <rect y="56" width="120" height="8" fill="#f6e2c0"/><rect y="72" width="120" height="12" fill="#c98a5a"/><rect y="94" width="120" height="8" fill="#b8704a"/>
       <path d="M0 30 Q30 26 60 30 T120 30 M0 68 Q30 64 60 68 T120 68" stroke="#f6e2c0" stroke-width="2" fill="none" opacity=".7"/>
       <ellipse cx="78" cy="78" rx="12" ry="7" fill="#d9573a"/><ellipse cx="77" cy="77" rx="7" ry="3.5" fill="#ef7a55"/></g>
       <circle cx="60" cy="60" r="56" fill="url(#jpS)"/>`,
      'deco-jupiter',
    ),
  spaceWhale: () =>
    svg(
      170,
      100,
      `<defs>${lin('whB', ['#8aa8ff', '#4a6fd8', '#2f4fb0'])}${lin('whY', ['#e0ebff', '#9fc1ff'])}</defs>
       <path d="M36 52 Q20 40 6 22 Q20 26 26 36 Q20 26 24 12 Q36 30 44 50Z" fill="url(#whB)"/>
       <path d="M30 50 Q40 22 96 22 Q150 24 164 56 Q168 80 130 84 L70 84 Q44 80 30 50Z" fill="url(#whB)"/>
       <path d="M70 84 Q120 92 150 76 Q130 70 90 72 Q76 74 70 84Z" fill="url(#whY)"/>
       <path d="M86 76 Q110 80 140 77 M80 80 Q110 85 136 81" stroke="#7d9cff" stroke-width="1.2" fill="none" opacity=".7"/>
       <path d="M100 74 Q96 90 84 96 Q104 94 112 76Z" fill="#3a5bc0"/>
       <path d="M56 36 Q80 26 110 28" stroke="#b9ccff" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>
       <g fill="#fff6c4"><circle cx="78" cy="42" r="2.5"/><circle cx="100" cy="36" r="2"/><circle cx="112" cy="50" r="2.5"/><circle cx="60" cy="56" r="2"/><circle cx="88" cy="56" r="1.6"/></g>
       <circle cx="138" cy="52" r="4" fill="#123"/><circle cx="139.5" cy="50.5" r="1.3" fill="#fff"/>
       <circle cx="146" cy="60" r="3.5" fill="#ff8fa3" opacity=".45"/>
       <path d="M146 66 Q154 68 160 62" stroke="#123" stroke-width="2.5" fill="none" stroke-linecap="round"/>
       <g fill="#bff6ff"><circle cx="120" cy="12" r="3"/><circle cx="129" cy="6" r="2"/><circle cx="111" cy="6" r="2"/></g>`,
      'deco-whale',
    ),
  earth: () =>
    svg(
      120,
      120,
      `<defs><clipPath id="ea"><circle cx="60" cy="60" r="56"/></clipPath>${rad('eaS', SHADE, 0.32, 0.28, 0.8)}${rad('eaG', ['#bff6ff/0', '#bff6ff/0', '#bff6ff/0.7', '#bff6ff/0'], 0.5, 0.5, 0.5)}</defs>
       <circle cx="60" cy="60" r="60" fill="url(#eaG)"/>
       <circle cx="60" cy="60" r="56" fill="#2e86de"/>
       <g clip-path="url(#ea)" fill="#5fc24a"><path d="M30 20 Q50 10 58 26 Q52 40 60 52 Q46 60 38 48 Q24 46 30 20Z"/>
       <path d="M70 60 Q92 54 100 70 Q96 92 80 104 Q72 90 74 78 Q64 70 70 60Z"/><path d="M8 70 Q20 66 26 80 Q18 92 6 88Z"/>
       <path d="M36 2 Q60 -2 84 2 Q60 10 36 2Z" fill="#fff"/></g>
       <path d="M18 60 Q38 54 54 62 M66 34 Q82 28 98 36 M40 96 Q54 92 66 98" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>
       <circle cx="60" cy="60" r="56" fill="url(#eaS)"/>`,
      'deco-earth',
    ),
  galaxy: () =>
    svg(
      160,
      120,
      `<defs>${rad('gxC', ['#ffffff', '#ffe3f7', '#ffb3f0/0.6', '#7a5cff/0'], 0.5, 0.5, 0.5)}${rad('gxH', ['#c9b3ff/0.55', '#7a5cff/0'], 0.5, 0.5, 0.5)}</defs>
       <g transform="rotate(-20 80 60)"><ellipse cx="80" cy="60" rx="76" ry="34" fill="url(#gxH)"/>
       <path d="M80 60 C100 44 132 48 142 62 M80 60 C60 76 28 72 18 58" stroke="#ffd6f5" stroke-width="4" fill="none" opacity=".35" stroke-linecap="round"/>
       <g fill="#fff" opacity=".7"><circle cx="112" cy="50" r="1.2"/><circle cx="128" cy="56" r="1"/><circle cx="48" cy="70" r="1.2"/><circle cx="32" cy="64" r="1"/></g>
       <ellipse cx="80" cy="60" rx="32" ry="15" fill="url(#gxC)"/></g>
       <g fill="#fff"><circle cx="24" cy="22" r="1.4"/><circle cx="138" cy="30" r="1.2"/><circle cx="124" cy="100" r="1.6"/><circle cx="40" cy="96" r="1.1"/><circle cx="100" cy="16" r="1"/><circle cx="60" cy="40" r="1"/></g>`,
      'deco-galaxy',
    ),
  shootingStar: () =>
    svg(
      172,
      80,
      `<defs>${lin('ssP', ['#ff5d8f/0', '#ff5d8f/0.85'], 1, 0)}${lin('ssY', ['#ffd23f/0', '#ffd23f/0.85'], 1, 0)}${lin('ssC', ['#2ec4d6/0', '#2ec4d6/0.85'], 1, 0)}${lin('ssS', ['#fff6c4', '#ffd23f', '#ffb627'])}</defs>
       <g fill="none" stroke-width="6" stroke-linecap="round"><path d="M4 22 Q70 34 130 38" stroke="url(#ssP)"/>
       <path d="M10 36 Q70 42 130 44" stroke="url(#ssY)"/><path d="M4 54 Q70 52 130 50" stroke="url(#ssC)"/></g>
       <path transform="translate(118 18) scale(0.5)" d="${STAR_PATH}" fill="url(#ssS)" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
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
      `<defs>${rad('suC', ['#fff8d6', '#ffe066', '#ffc23f'], 0.38, 0.32, 0.8)}${lin('suR', ['#ffd66b', '#ff9f1c'])}</defs>
       <path d="${rays}" fill="url(#suR)"/><circle cx="80" cy="80" r="52" fill="#ffb627"/><circle cx="80" cy="80" r="47" fill="url(#suC)"/>
       <circle cx="64" cy="74" r="5" fill="#7a4b2a"/><circle cx="96" cy="74" r="5" fill="#7a4b2a"/>
       <circle cx="65.5" cy="72.5" r="1.6" fill="#fff"/><circle cx="97.5" cy="72.5" r="1.6" fill="#fff"/>
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
