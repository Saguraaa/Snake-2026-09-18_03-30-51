const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require(process.env.SNAKE_SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '../../Assets/Art/2D/SnakePixelArt');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const data = new Map();
async function main() {
  for (const a of manifest.assets) {
    const svg = await sharp(path.join(root, a.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const png = await sharp(path.join(root, a.png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(png.info.width, a.width, a.id);
    assert.equal(png.info.height, a.height, a.id);
    assert.deepEqual(svg.data, png.data, `${a.id}: SVG and PNG differ`);
    for (let p = 3; p < png.data.length; p += 4) assert.ok([0, 255].includes(png.data[p]), `${a.id}: antialiasing`);
    data.set(a.id, { ...a, rgba: png.data });
  }
  let seams = 0;
  const alphaEdge = (id, side) => {
    const a = data.get(id), samples = [];
    for (let i = 0; i < a.width; i++) {
      const x = side === 'l' ? 0 : side === 'r' ? a.width - 1 : i;
      const y = side === 't' ? 0 : side === 'b' ? a.height - 1 : i;
      samples.push(a.rgba[(y * a.width + x) * 4 + 3]);
    }
    return samples;
  };
  const rows = [['top_left','top','top_right'],['left','center','right'],['bottom_left','bottom','bottom_right']];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const id = `grass_${rows[y][x]}`;
    if (x < 2) { assert.deepEqual(alphaEdge(id,'r'), alphaEdge(`grass_${rows[y][x+1]}`,'l'), `${id}: horizontal seam`); seams++; }
    if (y < 2) { assert.deepEqual(alphaEdge(id,'b'), alphaEdge(`grass_${rows[y+1][x]}`,'t'), `${id}: vertical seam`); seams++; }
  }
  for (const [id, a, neighborA, b, neighborB] of [
    ['grass_inner_tl','t','grass_left','l','grass_top'],
    ['grass_inner_tr','t','grass_right','r','grass_top'],
    ['grass_inner_bl','b','grass_left','l','grass_bottom'],
    ['grass_inner_br','b','grass_right','r','grass_bottom'],
  ]) {
    const opposite = {t:'b',b:'t',l:'r',r:'l'};
    for (const [edge, neighbor] of [[a,neighborA],[b,neighborB]]) {
      assert.deepEqual(alphaEdge(id,edge),alphaEdge(neighbor,opposite[edge]),`${id}: concave seam`);
      seams++;
    }
  }
  for (const [id, side, straight, opposite] of [
    ['body_corner_left_up','l','body_horizontal','r'],['body_corner_left_up','t','body_vertical','b'],
    ['body_corner_up_right','t','body_vertical','b'],['body_corner_up_right','r','body_horizontal','l'],
    ['body_corner_right_down','r','body_horizontal','l'],['body_corner_right_down','b','body_vertical','t'],
    ['body_corner_down_left','b','body_vertical','t'],['body_corner_down_left','l','body_horizontal','r'],
    ['head_up','b','body_vertical','t'],['head_right','l','body_horizontal','r'],
    ['tail_up','t','body_vertical','b'],['tail_right','r','body_horizontal','l'],
  ]) { assert.deepEqual(alphaEdge(id, side), alphaEdge(straight, opposite), `${id}: connector`); seams++; }
  const turns = manifest.assets.filter(a => a.from);
  for (const seq of turns) {
    const part = seq.id.split('_')[0];
    assert.deepEqual(data.get(`${seq.id}_0`).rgba, data.get(`${part}_${seq.from}`).rgba, `${seq.id}: first frame`);
    assert.deepEqual(data.get(`${seq.id}_5`).rgba, data.get(`${part}_${seq.to}`).rgba, `${seq.id}: final frame`);
    assert.equal(new Set(Array.from({length:6},(_,i)=>data.get(`${seq.id}_${i}`).rgba.toString('base64'))).size, 6, `${seq.id}: distinct frames`);
    assert.equal(seq.frameDurationsMs.reduce((a,b)=>a+b,0), 250);
  }
  const report = { assets: data.size, svgPngIdentical: true, integerAlphaOnly: true, seamChecks: seams, turnSequences: turns.length, turnEndpointsMatch: true };
  console.log(JSON.stringify(report,null,2));
  fs.writeFileSync(path.resolve(__dirname,'../../ArtPreviews/SnakePixelArt/validation.json'),JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
