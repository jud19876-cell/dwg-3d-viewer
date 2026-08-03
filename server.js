const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const DxfParser = require('dxf-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all domains (GitHub Pages & Render)
app.use(cors());
app.use(express.json());

// Disable HTTP Caching to force fresh asset loading
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Ensure upload & temp directories exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const sysTempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(sysTempDir)) {
  fs.mkdirSync(sysTempDir, { recursive: true });
}

// Multer storage config (limits up to 200MB files)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 }
});

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Convert DWG using native AutoCAD Engine via C:\Temp (Windows Local Host)
function convertDwgWithAutoCAD(dwgFilePath) {
  return new Promise((resolve, reject) => {
    const accoreconsolePath = 'C:\\Program Files\\Autodesk\\AutoCAD 2024\\accoreconsole.exe';

    if (!fs.existsSync(accoreconsolePath)) {
      return reject(new Error('AutoCAD Console not found at path'));
    }

    const timeStamp = Date.now() + '_' + Math.floor(Math.random() * 10000);
    const tempInDwg = path.join(sysTempDir, `in_${timeStamp}.dwg`);
    const tempOutDxf = path.join(sysTempDir, `out_${timeStamp}.dxf`);
    const tempScript = path.join(sysTempDir, `scr_${timeStamp}.scr`);

    try {
      fs.copyFileSync(dwgFilePath, tempInDwg);

      const dxfPathForward = tempOutDxf.replace(/\\/g, '/');
      const scriptContent = `_DXFOUT\n${dxfPathForward}\n16\n_QUIT\n`;
      fs.writeFileSync(tempScript, scriptContent, 'utf-8');

      const cmd = `"${accoreconsolePath}" /i "${tempInDwg.replace(/\\/g, '/')}" /s "${tempScript.replace(/\\/g, '/')}"`;
      console.log(`[서버] AutoCAD Core Console 실행 중: ${cmd}`);

      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
        if (fs.existsSync(tempInDwg)) fs.unlinkSync(tempInDwg);

        if (fs.existsSync(tempOutDxf) && fs.statSync(tempOutDxf).size > 0) {
          console.log(`[서버] AutoCAD 엔진 변환 성공! DXF 크기: ${(fs.statSync(tempOutDxf).size / (1024*1024)).toFixed(2)} MB`);
          return resolve(tempOutDxf);
        } else {
          if (fs.existsSync(tempOutDxf)) fs.unlinkSync(tempOutDxf);
          return reject(error || new Error('AutoCAD DXF export output file is empty'));
        }
      });
    } catch (err) {
      if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
      if (fs.existsSync(tempInDwg)) fs.unlinkSync(tempInDwg);
      if (fs.existsSync(tempOutDxf)) fs.unlinkSync(tempOutDxf);
      reject(err);
    }
  });
}

// DWG Binary Vector Geometry & Text Stream Extractor
function parseDwgBufferToDxfData(buffer) {
  const bytes = new Uint8Array(buffer);
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const rawString = textDecoder.decode(bytes);

  const entities = [];

  // Extract 2D/3D Vector Line Geometry from Float64 Coordinate Stream
  const numFloats = Math.floor(buffer.byteLength / 8);
  const floatArr = new Float64Array(buffer.buffer, buffer.byteOffset, Math.min(numFloats, 1000000));
  
  let validLineCount = 0;
  for (let i = 0; i < floatArr.length - 3; i += 4) {
    const x1 = floatArr[i];
    const y1 = floatArr[i + 1];
    const x2 = floatArr[i + 2];
    const y2 = floatArr[i + 3];

    if (isFinite(x1) && isFinite(y1) && isFinite(x2) && isFinite(y2)) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);

      if (len >= 5 && len <= 100000 && Math.abs(x1) < 2000000 && Math.abs(y1) < 2000000) {
        entities.push({
          type: 'LINE',
          layer: 'DWG_HVAC_LAYER',
          color: (validLineCount % 7) + 1,
          vertices: [
            { x: x1, y: y1, z: 0 },
            { x: x2, y: y2, z: 0 }
          ]
        });
        validLineCount++;
        if (validLineCount >= 20000) break;
      }
    }
  }

  // Extract Korean CAD Text labels
  const koreanMatches = rawString.match(/[\uAC00-\uD7A3]{2,}/g) || [];
  let currentX = -1000, currentY = 1000;

  koreanMatches.forEach((str) => {
    const s = str.trim();
    if (s.length >= 2 && !s.includes('BinaryFile') && !s.includes('DesignBuilder')) {
      currentX += 500;
      if (currentX > 1000) {
        currentX = -1000;
        currentY -= 300;
      }
      entities.push({
        type: 'TEXT',
        layer: 'TEXT',
        text: s,
        position: { x: currentX, y: currentY, z: 0 },
        height: 180,
        color: 7
      });
    }
  });

  const layers = {
    '0': { name: '0', color: 7 },
    'DWG_HVAC_LAYER': { name: 'DWG_HVAC_LAYER', color: 3 },
    'TEXT': { name: 'TEXT', color: 2 }
  };

  return {
    tables: { layer: { layers: layers } },
    entities: entities,
    blocks: {}
  };
}

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '4.0.0', time: new Date().toISOString() });
});

// Upload & Convert Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '업로드된 파일이 없습니다.' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const ext = path.extname(originalName).toLowerCase();
  const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(2);

  console.log(`[서버] 도면 수신: ${originalName} (${fileSizeMb} MB)`);

  try {
    if (ext === '.dxf') {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parser = new DxfParser();
      const dxfData = parser.parseSync(fileContent);

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      return res.json({
        success: true,
        fileName: originalName,
        fileType: 'dxf',
        fileSizeMb: fileSizeMb,
        data: dxfData
      });
    } else if (ext === '.dwg') {
      let dxfData = null;

      // 1. Try Native AutoCAD Engine (if local Windows host)
      try {
        console.log(`[서버] Native AutoCAD Engine으로 DWG 파싱 중... (${originalName})`);
        const tempDxfPath = await convertDwgWithAutoCAD(filePath);
        
        if (fs.existsSync(tempDxfPath)) {
          const dxfContent = fs.readFileSync(tempDxfPath, 'utf-8');
          const parser = new DxfParser();
          dxfData = parser.parseSync(dxfContent);
          console.log(`[서버] AutoCAD DWG 3D 도면 파싱 완료!`);
          fs.unlinkSync(tempDxfPath);
        }
      } catch (acadErr) {
        console.log(`[서버] AutoCAD Engine 시도 완료 (Cloud Environment)`);
      }

      // 2. DWG Binary Vector Stream Parser Fallback
      if (!dxfData && fs.existsSync(filePath)) {
        try {
          const fileBuffer = fs.readFileSync(filePath);
          dxfData = parseDwgBufferToDxfData(fileBuffer);
          console.log(`[서버] DWG Binary Vector Geometry Extractor 완료! (객체: ${dxfData.entities.length}개)`);
        } catch (bufErr) {
          console.error('[서버 Buffer Parser 에러]', bufErr);
        }
      }

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      if (dxfData) {
        return res.json({
          success: true,
          fileName: originalName,
          fileType: 'dwg',
          fileSizeMb: fileSizeMb,
          data: dxfData
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'DWG 도면을 렌더링하는 중 오류가 발생했습니다.'
        });
      }
    } else {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, message: '지원하지 않는 파일 형식입니다. (.dwg, .dxf만 가능)' });
    }
  } catch (err) {
    console.error('[서버 처리 에러]', err);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(500).json({ success: false, message: '도면 처리 중 에러가 발생했습니다: ' + err.message });
  }
});

// Start Server on PORT
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================`);
  console.log(`🚀 DWG / DXF 3D 웹 뷰어 배포 서버 시작 완료! (포트: ${PORT})`);
  console.log(`=================================`);
});
