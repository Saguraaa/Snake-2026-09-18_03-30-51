/* Original pixel drawings. SVG is exported as integer-aligned horizontal runs. */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SNAKE_SHARP_MODULE || 'sharp');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'Assets/Art/2D/SnakePixelArt');
const PREVIEW = path.join(ROOT, 'ArtPreviews/SnakePixelArt');
const C = {
  ink: '#211f30', grass: '#72a11d', grassLight: '#a4cc42', grassDark: '#28860f',
  grassDeep: '#076029', grassGlint: '#e1f394', cyan: '#6cd9f1', cyanLight: '#acf7fa',
  cyanDark: '#2facda', cyanDeep: '#177aa8', white: '#ffffff', pink: '#e44a6e',
  pinkDark: '#9c1b4d', red: '#e44a4a', redDark: '#cc3048', yellow: '#f8d76d',
};
const assets = [];
const byId = new Map();
const directions = ['up', 'right', 'down', 'left'];
const grid = (w, h = w) => ({ w, h, p: Array(w * h).fill(null) });
const at = (g, x, y) => x >= 0 && x < g.w && y >= 0 && y < g.h ? g.p[y * g.w + x] : null;
function dot(g, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && x < g.w && y >= 0 && y < g.h) g.p[y * g.w + x] = color;
}
function rect(g, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) dot(g, xx, yy, color);
}
function rotate(g, turns) {
  let result = g;
  for (let k = 0; k < (turns + 4) % 4; k++) {
    const next = grid(result.h, result.w);
    for (let y = 0; y < result.h; y++) for (let x = 0; x < result.w; x++) dot(next, result.h - 1 - y, x, at(result, x, y));
    result = next;
  }
  return result;
}
function paste(g, sprite, x, y, scale = 1) {
  for (let yy = 0; yy < sprite.h; yy++) for (let xx = 0; xx < sprite.w; xx++) {
    const color = at(sprite, xx, yy);
    if (color) rect(g, x + xx * scale, y + yy * scale, scale, scale, color);
  }
}
function svgRects(g) {
  const rows = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w;) {
    const color = at(g, x, y);
    let end = x + 1;
    while (end < g.w && at(g, end, y) === color) end++;
    if (color) rows.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${color}"/>`);
    x = end;
  }
  return rows.join('\n');
}
function svg(g, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.w}" height="${g.h}" viewBox="0 0 ${g.w} ${g.h}" shape-rendering="crispEdges"><title>${title}</title>\n${svgRects(g)}\n</svg>\n`;
}
function add(id, folder, pixels, details = {}) {
  if (byId.has(id)) throw Error(`Duplicate asset: ${id}`);
  const a = { id, folder, pixels, width: pixels.w, height: pixels.h, ...details };
  assets.push(a); byId.set(id, a); return a;
}
function outlineShape(g, inside, bodyColor) {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (!inside(x, y)) continue;
    const border = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && nx < g.w && ny >= 0 && ny < g.h && !inside(nx, ny);
    });
    dot(g, x, y, border ? C.ink : bodyColor(x, y));
  }
}

// Terrain uses a common edge profile so adjacent tiles meet without seams.
function grass(edges = '', inner = '', variant = 0) {
  const g = grid(16);
  const clipped = (x, y) => {
    const notch = n => [7, 8, 12].includes(n) ? 1 : 0;
    if (edges.includes('t') && y < 1 + notch(x)) return true;
    if (edges.includes('b') && y > 14 - notch(x)) return true;
    if (edges.includes('l') && x < 1 + notch(y)) return true;
    if (edges.includes('r') && x > 14 - notch(y)) return true;
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      const xx = corner.includes('l') ? x : 15 - x;
      const yy = corner.includes('t') ? y : 15 - y;
      if (edges.includes(corner[0]) && edges.includes(corner[1]) && xx + yy < 5) return true;
      if (inner === corner && xx === 0 && yy === 0) return true;
    }
    return false;
  };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (clipped(x, y)) continue;
    let c = C.grass;
    const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    if (neighbors.some(([dx, dy]) => x + dx >= 0 && x + dx < 16 && y + dy >= 0 && y + dy < 16 && clipped(x + dx, y + dy))) c = C.grassDeep;
    else if ((edges.includes('b') && y >= 12) || (edges.includes('r') && x >= 13)) c = C.grassDark;
    else if ((edges.includes('t') && y <= 3) || (edges.includes('l') && x <= 2)) c = C.grassLight;
    else if (inner && neighbors.some(([dx, dy]) => clipped(x + dx * 2, y + dy * 2))) c = C.grassDark;
    dot(g, x, y, c);
  }
  const tufts = [ [[4, 6], [10, 11]], [[9, 5], [4, 11]], [[5, 5], [11, 10]], [[10, 6], [5, 10]] ][variant];
  for (const [x, y] of tufts) {
    if (at(g, x, y) !== C.grass || at(g, x + 2, y + 1) !== C.grass) continue;
    dot(g, x, y, C.grassLight); dot(g, x + 2, y, C.grassLight);
    dot(g, x + 1, y + 1, C.grassDark); dot(g, x + 2, y + 1, C.grassDark);
  }
  if (variant === 3) { dot(g, 6, 5, C.grassGlint); dot(g, 7, 5, C.grassLight); }
  if (inner) {
    const vertical = grass(inner[1]), horizontal = grass(inner[0]);
    const edgeX = inner[1] === 'l' ? 0 : 15, edgeY = inner[0] === 't' ? 0 : 15;
    for (let i = 0; i < 16; i++) {
      dot(g, i, edgeY, at(vertical, i, 15 - edgeY));
      dot(g, edgeX, i, at(horizontal, 15 - edgeX, i));
    }
  }
  return g;
}
const terrainDefs = [
  ['top_left', 'tl'], ['top', 't'], ['top_right', 'tr'],
  ['left', 'l'], ['center', ''], ['right', 'r'],
  ['bottom_left', 'bl'], ['bottom', 'b'], ['bottom_right', 'br'],
];
for (const [name, edge] of terrainDefs) add(`grass_${name}`, 'Grass', grass(edge), { exposedEdges: edge });
for (const corner of ['tl', 'tr', 'bl', 'br']) add(`grass_inner_${corner}`, 'Grass', grass('', corner), { innerCorner: corner });
for (let i = 1; i <= 3; i++) add(`grass_center_${i + 1}`, 'Grass', grass('', '', i), { variant: i + 1 });

function body(curved = false) {
  const g = grid(32);
  // The corner connects the left and top edge via a quarter-circle, radius 16.
  const distance = (x, y) => curved ? Math.abs(Math.hypot(x + 0.5, y + 0.5) - 16) : Math.abs(y - 15.5);
  outlineShape(g, (x, y) => distance(x, y) < 10, (x, y) => {
    const signed = curved ? Math.hypot(x + 0.5, y + 0.5) - 16 : y - 15.5;
    return signed > 6 ? C.cyanDeep : signed > 3 ? C.cyanDark : signed < -5 ? C.cyanLight : C.cyan;
  });
  if (curved) {
    [[5, 14], [10, 11], [14, 5]].forEach(([x, y]) => {
      rect(g, x, y, 3, 2, C.cyanDark); dot(g, x, y - 1, C.cyanLight);
    });
  } else {
    [[8, 14], [24, 14]].forEach(([x, y]) => { rect(g, x, y, 3, 2, C.cyanDark); rect(g, x - 1, y - 1, 3, 1, C.cyanLight); });
  }
  return g;
}
add('body_horizontal', 'Snake/Body', body());
add('body_vertical', 'Snake/Body', rotate(body(), 1));
['left_up', 'up_right', 'right_down', 'down_left'].forEach((name, i) => add(`body_corner_${name}`, 'Snake/Body', rotate(body(true), i), { connections: name.split('_') }));

function head(angle = 0, squash = 0, blink = false, glance = 0) {
  const g = grid(32), a = angle * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  const local = (x, y) => ({ x: (x - 15.5) * co + (y - 15.5) * si + 15.5, y: -(x - 15.5) * si + (y - 15.5) * co + 15.5 });
  const inHead = (x, y) => {
    const p = local(x, y);
    const w = 12.8 + squash;
    return ((p.x - 15.5) / w) ** 2 + ((p.y - (15 - squash)) / (12 - squash)) ** 2 <= 1 || (p.y >= 17 && p.y <= 38 && p.x >= 6 && p.x <= 25);
  };
  outlineShape(g, inHead, (x, y) => {
    const p = local(x, y);
    return p.y > 25 || p.x > 25 ? C.cyanDeep : p.y > 22 || p.x > 23 ? C.cyanDark : p.y < 7 || p.x < 6 ? C.cyanLight : C.cyan;
  });
  function patch(x, y, w, h, color) {
    for (let yy = 0; yy < 32; yy++) for (let xx = 0; xx < 32; xx++) {
      const p = local(xx, yy);
      if (p.x >= x && p.x < x + w && p.y >= y - squash && p.y < y - squash + h && at(g, xx, yy)) dot(g, xx, yy, color);
    }
  }
  patch(9, 5, 8, 2, C.cyanLight);
  patch(11, 7, 2, 1, C.cyanDeep); patch(19, 7, 2, 1, C.cyanDeep);
  for (const x of [7, 20]) {
    patch(x - 1, 10, 7, blink ? 3 : 9, C.ink);
    if (!blink) {
      patch(x, 10, 5, 7, C.white);
      patch(x + 1 + glance, 10, 3, 5, C.ink);
      patch(x + 1 + glance, 10, 1, 2, C.white);
    } else patch(x, 10, 5, 1, C.cyanDeep);
  }
  patch(5, 19, 3, 2, C.pink); patch(24, 19, 3, 2, C.pink);
  patch(12, 23, 8, 1, C.cyanDeep); patch(14, 24, 4, 1, C.cyanLight);
  patch(14, 27, 4, 2, C.cyanDark);
  return g;
}
function tail(angle = 0, squash = 0) {
  const g = grid(32), a = angle * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  const local = (x, y) => ({ x: (x - 15.5) * co + (y - 15.5) * si + 15.5, y: -(x - 15.5) * si + (y - 15.5) * co + 15.5 });
  outlineShape(g, (x, y) => {
    const p = local(x, y), half = p.y < 9 ? 10 : Math.max(1, 10 - (p.y - 9) * 0.47);
    return p.y < 30 && p.y > -6 && Math.abs(p.x - 15.5 - squash * Math.sin(p.y / 10)) < half;
  }, (x, y) => {
    const p = local(x, y);
    return p.x > 20 ? C.cyanDeep : p.x > 17 ? C.cyanDark : p.x < 10 ? C.cyanLight : p.y > 24 ? C.yellow : C.cyan;
  });
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const p = local(x, y);
    if (at(g, x, y) && at(g, x, y) !== C.ink && p.x >= 14 && p.x < 17 && p.y >= 10 && p.y < 12) dot(g, x, y, C.cyanDark);
  }
  return g;
}
for (let i = 0; i < 4; i++) {
  add(`head_${directions[i]}`, 'Snake/Head', rotate(head(), i), { direction: directions[i] });
  add(`tail_${directions[i]}`, 'Snake/Tail', rotate(tail(), i), { direction: directions[i], meaning: 'direction of travel; connector at front, tip at rear' });
}
function strip(id, frames, details) {
  const g = grid(frames.length * 32, 32);
  frames.forEach((f, i) => paste(g, f, i * 32, 0));
  add(id, 'Animations/Sheets', g, { frameWidth: 32, frameHeight: 32, frameCount: frames.length, ...details });
}
for (let d = 0; d < 4; d++) {
  const id = `head_idle_${directions[d]}`;
  const frames = [head(), head(0, 0.6), head(0, 0.6, true), head()];
  const images = frames.map(f => rotate(f, d));
  images.forEach((f, i) => add(`${id}_${i}`, `Animations/Frames/${id}`, f, { sequence: id, frame: i }));
  strip(id, images, { fps: 6, loop: true, frameDurationsMs: [600, 120, 100, 380] });
  for (const sign of [-1, 1]) {
    const to = (d + sign + 4) % 4;
    const angles = [0, -5 * sign, 22 * sign, 57 * sign, 96 * sign, 90 * sign];
    for (const part of ['head', 'tail']) {
      const seq = `${part}_turn_${directions[d]}_to_${directions[to]}`;
      const frames = angles.map((angle, i) => {
        const squeeze = [0, 1, 0.4, -0.3, 0.5, 0][i];
        if (i === 0) return byId.get(`${part}_${directions[d]}`).pixels;
        if (i === 5) return byId.get(`${part}_${directions[to]}`).pixels;
        return rotate(part === 'head' ? head(angle, squeeze, false, i === 1 ? sign : 0) : tail(angle, squeeze), d);
      });
      frames.forEach((f, i) => add(`${seq}_${i}`, `Animations/Frames/${seq}`, f, { sequence: seq, frame: i }));
      strip(seq, frames, { from: directions[d], to: directions[to], turn: sign === 1 ? 'clockwise' : 'counterclockwise', fps: 24, loop: false, frameDurationsMs: [35, 35, 45, 45, 40, 50] });
    }
  }
}
function fruit() {
  const g = grid(32);
  const rows = [
    '       oo       ', '      oggo      ', '    oobggo      ', '    obboo       ',
    '  ooorrooooo    ', ' orrrhrrrdddo   ', 'orrhhrrrrrdddo  ', 'orrhrrrrrrdddo  ',
    'orrrrrrrrrdddo  ', 'orrrrrrrrrdddo  ', ' orrrrrrrdddo   ', ' orrrrrrrdddo   ',
    '  orrrrddddo    ', '   orrrdddo     ', '    oooooo      ',
  ];
  const pal = { o: C.ink, g: C.grassLight, b: C.grassDeep, r: C.red, d: C.redDark, h: '#ffd8ab' };
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) dot(g, x + 9, y + 8, pal[ch]); }));
  return g;
}
add('fruit_apple', 'Fruit', fruit());

function pngMeta() {
  return `fileFormatVersion: 2\nguid: ${require('node:crypto').randomBytes(16).toString('hex')}\nTextureImporter:\n  serializedVersion: 13\n  internalIDToNameTable: []\n  externalObjects: {}\n  mipmaps:\n    mipMapMode: 0\n    enableMipMap: 0\n    sRGBTexture: 1\n  isReadable: 0\n  textureSettings:\n    serializedVersion: 2\n    filterMode: 0\n    aniso: 0\n    mipBias: 0\n    wrapU: 1\n    wrapV: 1\n    wrapW: 1\n  nPOTScale: 0\n  maxTextureSize: 2048\n  textureCompression: 0\n  spriteMode: 1\n  spriteExtrude: 0\n  spriteMeshType: 0\n  alignment: 0\n  spritePivot: {x: 0.5, y: 0.5}\n  spritePixelsToUnits: 16\n  spriteBorder: {x: 0, y: 0, z: 0, w: 0}\n  spriteGenerateFallbackPhysicsShape: 0\n  alphaUsage: 1\n  alphaIsTransparency: 1\n  textureType: 8\n  textureShape: 1\n  platformSettings:\n  - serializedVersion: 4\n    buildTarget: DefaultTexturePlatform\n    maxTextureSize: 2048\n    textureFormat: -1\n    textureCompression: 0\n    compressionQuality: 100\n    crunchedCompression: 0\n    overridden: 0\n  spriteSheet:\n    serializedVersion: 2\n    sprites: []\n    outline: []\n    physicsShape: []\n    bones: []\n    spriteID: 5e97eb03825dee720800000000000000\n    internalID: 0\n    vertices: []\n    indices:\n    edges: []\n    weights: []\n    secondaryTextures: []\n    nameFileIdTable: {}\n  userData:\n  assetBundleName:\n  assetBundleVariant:\n`;
}
function save(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
async function writeAsset(a) {
  const relative = `${a.folder}/${a.id}`;
  save(path.join(OUT, `SVG/${relative}.svg`), svg(a.pixels, a.id));
  const pngPath = path.join(OUT, `PNG/${relative}.png`);
  fs.mkdirSync(path.dirname(pngPath), { recursive: true });
  await sharp(Buffer.from(svg(a.pixels, a.id))).png().toFile(pngPath);
  if (!fs.existsSync(`${pngPath}.meta`)) save(`${pngPath}.meta`, pngMeta());
}
function makeMap() {
  const g = grid(320, 224);
  const exists = (x, y) => x > 0 && x < 19 && y > 0 && y < 13 && !(x >= 16 && y >= 10);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 20; x++) {
    if (!exists(x, y)) continue;
    const horizontal = !exists(x, y - 1) ? 'top' : !exists(x, y + 1) ? 'bottom' : '';
    const vertical = !exists(x - 1, y) ? 'left' : !exists(x + 1, y) ? 'right' : '';
    const edge = [horizontal, vertical].filter(Boolean).join('_');
    const variant = (x * 3 + y * 7) % 11;
    let id = edge || (variant < 3 ? `center_${variant + 2}` : 'center');
    if (!edge) for (const [dx, dy, suffix] of [[-1,-1,'tl'],[1,-1,'tr'],[-1,1,'bl'],[1,1,'br']]) {
      if (!exists(x + dx, y + dy)) id = `inner_${suffix}`;
    }
    paste(g, byId.get(`grass_${id}`).pixels, x * 16, y * 16);
  }
  const segments = [
    ['tail_right', 48, 128], ['body_horizontal', 80, 128], ['body_corner_left_up', 112, 128],
    ['body_vertical', 112, 96], ['body_corner_right_down', 112, 64],
    ['body_horizontal', 144, 64], ['head_right', 176, 64],
  ];
  for (const [id, x, y] of segments) paste(g, byId.get(id).pixels, x, y);
  paste(g, fruit(), 240, 64); paste(g, fruit(), 48, 32); paste(g, fruit(), 224, 160);
  return g;
}
const e = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
function board() {
  const blocks = [];
  const text = (x, y, size, value, color = '#edf3f7') => blocks.push(`<text x="${x}" y="${y}" fill="${color}" font-family="Segoe UI,Arial,sans-serif" font-size="${size}">${e(value)}</text>`);
  const pixel = (g, x, y, scale) => blocks.push(`<g transform="translate(${x} ${y}) scale(${scale})">${svgRects(g)}</g>`);
  blocks.push('<rect width="1280" height="1150" fill="#171d25"/>');
  text(40, 48, 27, 'SNAKE / PIXEL ADVENTURE');
  text(40, 77, 14, 'Original SVG assets  /  16 px terrain  /  32 px characters  /  16 PPU', '#9aaeba');
  pixel(makeMap(), 40, 130, 2);
  text(800, 136, 18, 'GRASS / 16 TILES');
  terrainDefs.forEach(([n], i) => pixel(byId.get(`grass_${n}`).pixels, 802 + i % 3 * 55, 159 + Math.floor(i / 3) * 55, 3));
  ['tl', 'tr', 'bl', 'br'].forEach((n, i) => pixel(byId.get(`grass_inner_${n}`).pixels, 992 + i % 2 * 55, 159 + Math.floor(i / 2) * 55, 3));
  text(800, 344, 12, '9-slice', '#9aaeba'); text(991, 285, 12, 'Inner corners', '#9aaeba');
  [2, 3, 4].forEach((n, i) => pixel(byId.get(`grass_center_${n}`).pixels, 993 + i * 58, 303, 3));
  text(991, 374, 12, 'Center variants', '#9aaeba');
  text(800, 420, 18, 'CHARACTER / CONNECTED PARTS');
  ['head_up', 'head_right', 'head_down', 'head_left'].forEach((id, i) => pixel(byId.get(id).pixels, 800 + i * 103, 444, 2));
  ['tail_right', 'body_horizontal', 'body_corner_left_up'].forEach((id, i) => pixel(byId.get(id).pixels, 812 + i * 64, 558, 2));
  text(40, 708, 18, 'TURN / ANTICIPATE - BEND - OVERSHOOT - SETTLE');
  ['head_turn_up_to_right', 'head_turn_up_to_left', 'tail_turn_up_to_right'].forEach((id, row) => {
    const label = row === 0 ? 'Head / right' : row === 1 ? 'Head / left' : 'Tail / follow';
    text(40, 760 + row * 122, 14, label, '#9aaeba');
    for (let i = 0; i < 6; i++) {
      const x = 208 + i * 143, y = 733 + row * 122;
      blocks.push(`<rect x="${x - 3}" y="${y - 3}" width="102" height="102" fill="#232e37"/>`);
      pixel(byId.get(`${id}_${i}`).pixels, x, y, 3);
      text(x + 41, y + 115, 12, String(i + 1), '#9aaeba');
    }
  });
  text(40, 1122, 13, 'Palette reference: Pixel Adventure 1 / Terrain + Main Characters. New drawings; existing pack unchanged.', '#9aaeba');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1150" viewBox="0 0 1280 1150" shape-rendering="crispEdges">${blocks.join('\n')}</svg>`;
}
async function main() {
  fs.mkdirSync(PREVIEW, { recursive: true });
  for (const a of assets) await writeAsset(a);
  const atlas = grid(64);
  assets.filter(a => a.folder === 'Grass').forEach((a, i) => paste(atlas, a.pixels, i % 4 * 16, Math.floor(i / 4) * 16));
  const atlasAsset = add('grass_atlas_4x4', 'Atlases', atlas, { frameWidth: 16, frameHeight: 16, frameCount: 16 });
  await writeAsset(atlasAsset);
  const manifest = {
    version: 1, pixelsPerUnit: 16, terrainTilePixels: 16, snakeCellPixels: 32,
    coordinates: 'SVG/PNG: top-left origin, x right, y down. Directions refer to travel.',
    grassAtlasOrder: assets.filter(a => a.folder === 'Grass').map(a => a.id),
    palette: C,
    assets: assets.map(({ pixels, folder, ...a }) => ({ ...a, svg: `SVG/${folder}/${a.id}.svg`, png: `PNG/${folder}/${a.id}.png` })),
  };
  save(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  save(path.join(PREVIEW, 'contact-sheet.svg'), board());
  await sharp(Buffer.from(board())).png().toFile(path.join(PREVIEW, 'contact-sheet.png'));
  save(path.join(PREVIEW, 'sample-map.svg'), svg(makeMap(), 'Connected snake on tiled grass'));
  await sharp(Buffer.from(svg(makeMap(), 'map'))).resize(960, 672, { kernel: 'nearest' }).png().toFile(path.join(PREVIEW, 'sample-map.png'));
  const dataUrl = a => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(a.pixels, a.id))}`;
  const previewData = {
    map: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(makeMap(), 'Map'))}`,
    grass: assets.filter(a => a.folder === 'Grass').map(a => ({ id: a.id, src: dataUrl(a) })),
    stills: assets.filter(a => /^(Snake|Fruit)/.test(a.folder)).map(a => ({ id: a.id, src: dataUrl(a) })),
    sequences: assets.filter(a => a.folder === 'Animations/Sheets').map(a => ({ id: a.id, durations: a.frameDurationsMs, frames: Array.from({ length: a.frameCount }, (_, i) => dataUrl(byId.get(`${a.id}_${i}`))) })),
  };
  save(path.join(PREVIEW, 'preview-data.js'), `window.SNAKE_ART = ${JSON.stringify(previewData)};\n`);
  console.log(JSON.stringify({ assets: assets.length, grass: 16, turnSequences: 16, idleSequences: 4, output: OUT, preview: PREVIEW }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
