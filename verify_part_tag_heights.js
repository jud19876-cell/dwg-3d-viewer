const fs = require('fs');
const DxfParser = require('dxf-parser');

const dxfPath = 'C:\\Temp\\out_clean.dxf';
const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
const dxfData = new DxfParser().parseSync(dxfContent);

const partTags = [];
const processEnt = (entity, blocks) => {
  if ((entity.type === 'TEXT' || entity.type === 'MTEXT') && entity.text) {
    if (entity.text.includes('6005ZZ') || entity.text.includes('CRM') || entity.text.includes('39B055')) {
      partTags.push({
        text: entity.text,
        height: entity.height,
        layer: entity.layer
      });
    }
  } else if (entity.type === 'INSERT' && blocks && blocks[entity.name]) {
    const block = blocks[entity.name];
    if (block.entities) {
      block.entities.forEach(bEnt => processEnt(bEnt, blocks));
    }
  }
};

dxfData.entities.forEach(ent => processEnt(ent, dxfData.blocks));

console.log('Part Tag exact CAD heights:');
partTags.forEach((t, i) => console.log(`${i+1}. Text: "${t.text}" | Height: ${t.height} | Layer: "${t.layer}"`));
