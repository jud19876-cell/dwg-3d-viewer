const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const DxfParser = require('dxf-parser');
const { convertDwgToDxf } = require('dwg2dxf-converter');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Ensure upload & C:\Temp directories exist
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

// Convert DWG using native AutoCAD Engine via C:\Temp (clean ASCII path)
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
        // Cleanup script & temp in DWG
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

      // 1. Try Native AutoCAD 2024 Engine via C:\Temp (100% CAD precision)
      try {
        console.log(`[서버] Native AutoCAD Engine으로 DWG 파싱 중... (${originalName})`);
        const tempDxfPath = await convertDwgWithAutoCAD(filePath);
        
        if (fs.existsSync(tempDxfPath)) {
          const dxfContent = fs.readFileSync(tempDxfPath, 'utf-8');
          const parser = new DxfParser();
          dxfData = parser.parseSync(dxfContent);
          console.log(`[서버] AutoCAD DWG 3D 도면 파싱 완료! (엔티티: ${dxfData.entities ? dxfData.entities.length : 0}개)`);
          
          fs.unlinkSync(tempDxfPath);
        }
      } catch (acadErr) {
        console.log(`[서버] AutoCAD Engine 변환 실패 ➔ LibreDWG Wasm 변환 시도:`, acadErr.message);

        // 2. Fallback to LibreDWG Wasm Converter
        const tempWasmDxf = path.join(sysTempDir, `wasm_${Date.now()}.dxf`);
        try {
          const convResult = await convertDwgToDxf(filePath, tempWasmDxf, { timeout: 60000 });
          if (convResult && convResult.success && fs.existsSync(tempWasmDxf)) {
            const dxfContent = fs.readFileSync(tempWasmDxf, 'utf-8');
            const parser = new DxfParser();
            dxfData = parser.parseSync(dxfContent);
          }
        } catch (wasmErr) {
          console.log(`[서버] Wasm 변환 예외:`, wasmErr.message);
        } finally {
          if (fs.existsSync(tempWasmDxf)) fs.unlinkSync(tempWasmDxf);
        }
      } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

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

// Start Server on 0.0.0.0 (Available on local network)
const os = require('os');
app.listen(PORT, '0.0.0.0', () => {
  const networkInterfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }

  console.log(`================================================`);
  console.log(`🚀 DWG / DXF 3D 웹 뷰어 배포 서버 시작 완료!`);
  console.log(`💻 내 컴퓨터 접속 주소: http://localhost:${PORT}`);
  console.log(`🌐 사내 사설망(LAN) 다른 사람 접속 주소: http://${localIp}:${PORT}`);
  console.log(`================================================`);
});
