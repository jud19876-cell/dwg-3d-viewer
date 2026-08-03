const fs = require('fs');
const DxfParser = require('dxf-parser');

const dxfPath = 'C:\\Temp\\out_clean.dxf';
const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
const dxfData = new DxfParser().parseSync(dxfContent);

console.log('Inspecting Layer 8 state:');
console.log(dxfData.tables.layer.layers["8"]);
console.log(dxfData.tables.layer.layers["Defpoints"]);
