const fs = require('fs');
const path = require('path');
const DxfParser = require('dxf-parser');
const THREE = require('three');

const dxfPath = 'C:\\Temp\\out_clean.dxf';
const dxfContent = fs.readFileSync(dxfPath, 'utf-8');
const dxfData = new DxfParser().parseSync(dxfContent);

const cadGroup = new THREE.Group();

dxfData.entities.forEach(entity => {
  if (entity.type === 'LINE' && entity.vertices && entity.vertices.length >= 2) {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(entity.vertices[0].x, entity.vertices[0].y, 0),
      new THREE.Vector3(entity.vertices[1].x, entity.vertices[1].y, 0)
    ]);
    cadGroup.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xffffff })));
  } else if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices) {
    const pts = entity.vertices.map(v => new THREE.Vector3(v.x, v.y, 0));
    cadGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff })));
  }
});

const rawBox = new THREE.Box3().setFromObject(cadGroup);
const rawCenter = rawBox.getCenter(new THREE.Vector3());
console.log('Raw Center:', rawCenter);

cadGroup.position.set(-rawCenter.x, -rawCenter.y, 0);
cadGroup.updateMatrixWorld(true);

const centeredBox = new THREE.Box3().setFromObject(cadGroup);
const size = centeredBox.getSize(new THREE.Vector3());
console.log('2D Floorplan Size X:', size.x, 'Y:', size.y);

const aspect = 1920 / 1080;
let orthoWidth, orthoHeight;
if (size.x / size.y > aspect) {
  orthoWidth = size.x * 1.15;
  orthoHeight = orthoWidth / aspect;
} else {
  orthoHeight = size.y * 1.15;
  orthoWidth = orthoHeight * aspect;
}

console.log('Screen Aspect Ratio:', aspect);
console.log('Camera Ortho Width:', orthoWidth, 'Height:', orthoHeight);
console.log('Camera Frustum Top:', orthoHeight/2, 'Bottom:', -orthoHeight/2, 'Left:', -orthoWidth/2, 'Right:', orthoWidth/2);
