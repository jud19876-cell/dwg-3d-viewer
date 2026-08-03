const fs = require('fs');
const DxfParser = require('dxf-parser');

const dxfPath = 'C:\\Temp\\out_clean.dxf';
const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
const dxfData = new DxfParser().parseSync(dxfContent);

console.log('Searching for "005ZZ", "CRM5026DA", "39B0557220" in entities and blocks...');

const found = [];

const checkEnt = (entity, blockName) => {
  if (entity.text && (entity.text.includes('005ZZ') || entity.text.includes('CRM') || entity.text.includes('39B055'))) {
    found.push({
      type: entity.type,
      text: entity.text,
      layer: entity.layer,
      invisible: entity.invisible,
      hidden: entity.hidden,
      raw: entity,
      blockName: blockName || 'MAIN'
    });
  }
  if (entity.type === 'INSERT' && entity.attributes) {
    entity.attributes.forEach(attr => {
      if (attr.text && (attr.text.includes('005ZZ') || attr.text.includes('CRM') || attr.text.includes('39B055'))) {
        found.push({
          type: 'ATTRIB',
          text: attr.text,
          layer: attr.layer,
          invisible: attr.invisible,
          hidden: attr.hidden,
          raw: attr,
          blockName: entity.name
        });
      }
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
  console.log(`${idx+1}. Type: ${item.type} | Text: "${item.text}" | Layer: "${item.layer}" | Invisible: ${item.invisible} | Hidden: ${item.hidden} | Block: "${item.blockName}"`);
});
