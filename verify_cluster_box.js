const fs = require('fs');
const DxfParser = require('dxf-parser');

const dxfPath = 'C:\\Temp\\out_clean.dxf';
const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
const dxfData = new DxfParser().parseSync(dxfContent);

// Collect all line segment midpoints
const points = [];

const addPt = (x, y) => {
  if (isFinite(x) && isFinite(y)) {
    points.push({ x, y });
  }
};

const processEnt = (entity, blocks, parentMatrix) => {
  if (entity.type === 'LINE' && entity.vertices && entity.vertices.length >= 2) {
    addPt((entity.vertices[0].x + entity.vertices[1].x)/2, (entity.vertices[0].y + entity.vertices[1].y)/2);
  } else if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices) {
    entity.vertices.forEach(v => addPt(v.x, v.y));
  } else if (entity.type === 'INSERT' && blocks && blocks[entity.name]) {
    const block = blocks[entity.name];
    if (block.entities) {
      block.entities.forEach(bEnt => processEnt(bEnt, blocks, parentMatrix));
    }
  }
};

dxfData.entities.forEach(ent => processEnt(ent, dxfData.blocks, null));

console.log('Total Points:', points.length);

// Calculate median X and median Y
const sortedX = points.map(p => p.x).sort((a, b) => a - b);
const sortedY = points.map(p => p.y).sort((a, b) => a - b);

const medX = sortedX[Math.floor(sortedX.length / 2)];
const medY = sortedY[Math.floor(sortedY.length / 2)];

console.log('Median X:', medX, 'Median Y:', medY);

// Filter points within 1,000,000 units of median
const mainCluster = points.filter(p => Math.abs(p.x - medX) < 1000000 && Math.abs(p.y - medY) < 1000000);
console.log('Main Cluster Points:', mainCluster.length, `(${(mainCluster.length/points.length*100).toFixed(1)}%)`);

let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity;
mainCluster.forEach(p => {
  if (p.x < cMinX) cMinX = p.x;
  if (p.x > cMaxX) cMaxX = p.x;
  if (p.y < cMinY) cMinY = p.y;
  if (p.y > cMaxY) cMaxY = p.y;
});

console.log('Main Cluster Bounding Box:');
console.log('X:', cMinX, 'to', cMaxX, 'Width:', cMaxX - cMinX);
console.log('Y:', cMinY, 'to', cMaxY, 'Height:', cMaxY - cMinY);
console.log('Center X:', (cMinX + cMaxX)/2, 'Center Y:', (cMinY + cMaxY)/2);
