const fs = require('fs');
const DxfParser = require('dxf-parser');

const dxfPath = 'C:\\Temp\\out_clean.dxf';
const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
const dxfData = new DxfParser().parseSync(dxfContent);

const sampleTexts = [];
const processEnt = (entity, blocks) => {
  if ((entity.type === 'TEXT' || entity.type === 'MTEXT') && entity.text) {
    if (entity.text.includes('PROJECT') || entity.text.includes('APPROVED') || entity.text.includes('SCALE') || entity.text.includes('NAME OF DRAWN')) {
      sampleTexts.push({
        type: entity.type,
        text: entity.text.replace(/\r?\n|\r/g, ' '),
        height: entity.height,
        hJustification: entity.hJustification,
        vJustification: entity.vJustification,
        attachmentPoint: entity.attachmentPoint,
        startPoint: entity.startPoint,
        position: entity.position
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

console.log('Title block table sample texts:');
sampleTexts.forEach(t => console.log(t));
