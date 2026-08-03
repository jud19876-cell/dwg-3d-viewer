const fs = require('fs');
const DxfParser = require('dxf-parser');

const dxfPath = 'C:\\Temp\\out_clean.dxf';
const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
const dxfData = new DxfParser().parseSync(dxfContent);

console.log('Inspecting ALL text entities on Layer "8":');

const layer8Texts = [];

const checkEnt = (entity, blockName) => {
  const layer = entity.layer || '0';
  if ((entity.type === 'TEXT' || entity.type === 'MTEXT') && entity.text && layer === '8') {
    layer8Texts.push({
      text: entity.text.replace(/\r?\n|\r/g, ' '),
      blockName: blockName || 'MAIN'
    });
  }
};

dxfData.entities.forEach(ent => {
  checkEnt(ent);
  if (ent.type === 'INSERT' && dxfData.blocks && dxfData.blocks[ent.name]) {
    const b = dxfData.blocks[ent.name];
    if (b.entities) {
      b.entities.forEach(bEnt => checkEnt(bEnt, ent.name));
    }
  }
});

console.log(`Total Text entities on Layer "8": ${layer8Texts.length}`);
console.log('Unique texts on Layer "8":');
[...new Set(layer8Texts.map(t => t.text))].forEach(txt => console.log(`- "${txt}"`));
