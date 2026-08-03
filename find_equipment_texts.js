const fs = require('fs');
const DxfParser = require('dxf-parser');

const dxfPath = 'C:\\Temp\\out_clean.dxf';
const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
const dxfData = new DxfParser().parseSync(dxfContent);

console.log('Searching for "075", "data 5", "TM KOREA", "C/R" in entities and blocks...');

const found = [];

const checkEnt = (entity, blockName) => {
  if (entity.text && (entity.text.includes('075') || entity.text.includes('data 5') || entity.text.includes('KOREA') || entity.text.includes('C/R'))) {
    found.push({
      type: entity.type,
      text: entity.text.replace(/\r?\n|\r/g, ' '),
      layer: entity.layer,
      height: entity.height,
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

console.log('Found matching entities:', found.length);
found.forEach((item, idx) => {
  console.log(`${idx+1}. Type: ${item.type} | Text: "${item.text}" | Height: ${item.height} | Layer: "${item.layer}" | Block: "${item.blockName}"`);
});
