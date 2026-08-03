const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const DxfParser = require('dxf-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const sysTempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(sysTempDir)) fs.mkdirSync(sysTempDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// ─── AutoCAD DWG → DXF 변환 함수 ───────────────────────────────────────────
function convertDwgToAcadDxf(dwgFilePath) {
  return new Promise((resolve, reject) => {
    const possiblePaths = [
      'C:\\Program Files\\Autodesk\\AutoCAD 2024\\accoreconsole.exe',
      'C:\\Program Files\\Autodesk\\AutoCAD 2023\\accoreconsole.exe',
      'C:\\Program Files\\Autodesk\\AutoCAD 2022\\accoreconsole.exe',
      'C:\\Program Files\\Autodesk\\AutoCAD 2025\\accoreconsole.exe',
      'C:\\Program Files\\Autodesk\\AutoCAD 2026\\accoreconsole.exe',
    ];

    let accoreconsolePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) { accoreconsolePath = p; break; }
    }

    if (!accoreconsolePath) {
      return reject(new Error('AutoCAD가 설치되어 있지 않습니다. (accoreconsole.exe를 찾을 수 없음)'));
    }

    const ts = Date.now() + '_' + Math.floor(Math.random() * 10000);
    const tempInDwg  = path.join(sysTempDir, `in_${ts}.dwg`);
    const tempOutDxf = path.join(sysTempDir, `out_${ts}.dxf`);
    const tempScript = path.join(sysTempDir, `scr_${ts}.scr`);

    try {
      fs.copyFileSync(dwgFilePath, tempInDwg);
      const dxfFwd = tempOutDxf.replace(/\\/g, '/');
      fs.writeFileSync(tempScript, `_DXFOUT\n${dxfFwd}\n16\n_QUIT\n`, 'utf-8');

      const cmd = `"${accoreconsolePath}" /i "${tempInDwg.replace(/\\/g, '/')}" /s "${tempScript.replace(/\\/g, '/')}"`;
      console.log(`[AutoCAD] 변환 시작: ${cmd}`);

      exec(cmd, { timeout: 180000 }, (error, stdout, stderr) => {
        [tempScript, tempInDwg].forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {} });

        if (fs.existsSync(tempOutDxf) && fs.statSync(tempOutDxf).size > 0) {
          console.log(`[AutoCAD] DXF 변환 성공! (${(fs.statSync(tempOutDxf).size / 1024).toFixed(0)} KB)`);
          resolve(tempOutDxf);
        } else {
          try { if (fs.existsSync(tempOutDxf)) fs.unlinkSync(tempOutDxf); } catch {}
          reject(new Error('AutoCAD DXF 출력 파일이 생성되지 않았습니다.'));
        }
      });
    } catch (err) {
      [tempScript, tempInDwg, tempOutDxf].forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {} });
      reject(err);
    }
  });
}

// ─── CloudConvert DWG → DXF 변환 (배포 서버용) ──────────────────────────────
app.post('/api/convert-cloud', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '파일이 없습니다.' });

  const filePath  = req.file.path;
  const origName  = req.file.originalname;
  const ext       = path.extname(origName).toLowerCase();
  const baseName  = path.basename(origName, ext);
  const apiKey    = req.body.apiKey || req.headers['x-cloudconvert-apikey'] || '';

  console.log(`[CloudConvert] 변환 요청: ${origName} (${(req.file.size / (1024*1024)).toFixed(2)} MB)`);

  if (!apiKey) {
    try { fs.unlinkSync(filePath); } catch {}
    return res.status(400).json({ success: false, message: 'CloudConvert API 키가 필요합니다. https://cloudconvert.com/register 에서 무료로 발급받으세요.' });
  }

  if (ext === '.dxf') {
    // DXF는 그대로 반환
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.dxf"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('end', () => { try { fs.unlinkSync(filePath); } catch {} });
    return;
  }

  if (ext !== '.dwg') {
    try { fs.unlinkSync(filePath); } catch {}
    return res.status(400).json({ success: false, message: '.dwg 파일만 변환 가능합니다.' });
  }

  try {
    const CloudConvert = require('cloudconvert');
    const cloudConvert = new CloudConvert(apiKey, false); // false = production

    console.log('[CloudConvert] Job 생성 중...');
    const job = await cloudConvert.jobs.create({
      tasks: {
        'upload-dwg': {
          operation: 'import/upload'
        },
        'convert-to-dxf': {
          operation:  'convert',
          input:      'upload-dwg',
          input_format: 'dwg',
          output_format: 'dxf'
        },
        'export-dxf': {
          operation: 'export/url',
          input:     'convert-to-dxf'
        }
      }
    });

    console.log('[CloudConvert] 파일 업로드 중...');
    const uploadTask = job.tasks.find(t => t.name === 'upload-dwg');
    const fileStream = fs.createReadStream(filePath);
    await cloudConvert.tasks.upload(uploadTask, fileStream, origName);

    console.log('[CloudConvert] 변환 완료 대기 중...');
    const finishedJob = await cloudConvert.jobs.wait(job.id);

    const exportTask = finishedJob.tasks.find(t => t.name === 'export-dxf');
    if (!exportTask || !exportTask.result || !exportTask.result.files || exportTask.result.files.length === 0) {
      throw new Error('변환 결과 파일을 찾을 수 없습니다.');
    }

    const dxfUrl = exportTask.result.files[0].url;
    console.log(`[CloudConvert] DXF 다운로드 URL: ${dxfUrl}`);

    // DXF 파일 다운로드 후 클라이언트에 전달
    const https = require('https');
    const http  = require('http');
    const getter = dxfUrl.startsWith('https') ? https : http;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.dxf"`);

    getter.get(dxfUrl, (dxfRes) => {
      dxfRes.pipe(res);
      dxfRes.on('end', () => {
        try { fs.unlinkSync(filePath); } catch {}
        console.log(`[CloudConvert] ✅ 변환 완료! ${baseName}.dxf`);
      });
    }).on('error', (err) => {
      try { fs.unlinkSync(filePath); } catch {}
      res.status(500).json({ success: false, message: 'DXF 다운로드 실패: ' + err.message });
    });

  } catch (err) {
    console.error('[CloudConvert 오류]', err.message);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}

    let message = err.message;
    if (message.includes('401') || message.includes('Unauthorized')) {
      message = 'API 키가 올바르지 않습니다. CloudConvert 대시보드에서 API 키를 확인해주세요.';
    } else if (message.includes('402') || message.includes('Payment')) {
      message = '무료 변환 횟수를 초과했습니다. cloudconvert.com에서 크레딧을 충전해주세요.';
    } else if (message.includes('429')) {
      message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    }
    res.status(500).json({ success: false, message });
  }
});

// ─── 헬스 체크 ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const acadFound = [
    'C:\\Program Files\\Autodesk\\AutoCAD 2024\\accoreconsole.exe',
    'C:\\Program Files\\Autodesk\\AutoCAD 2023\\accoreconsole.exe',
    'C:\\Program Files\\Autodesk\\AutoCAD 2022\\accoreconsole.exe',
    'C:\\Program Files\\Autodesk\\AutoCAD 2025\\accoreconsole.exe',
    'C:\\Program Files\\Autodesk\\AutoCAD 2026\\accoreconsole.exe',
  ].some(p => fs.existsSync(p));

  res.json({ status: 'ok', autocadAvailable: acadFound, version: '5.0.0' });
});

// ─── DWG → DXF 변환 + 다운로드 ─────────────────────────────────────────────
app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '파일이 없습니다.' });

  const filePath   = req.file.path;
  const origName   = req.file.originalname;
  const ext        = path.extname(origName).toLowerCase();
  const baseName   = path.basename(origName, ext);
  const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(2);

  console.log(`[서버] 변환 요청: ${origName} (${fileSizeMb} MB)`);

  try {
    if (ext === '.dxf') {
      // DXF는 그대로 다운로드
      const dxfContent = fs.readFileSync(filePath, 'utf-8');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.dxf"`);
      res.send(dxfContent);
      try { fs.unlinkSync(filePath); } catch {}
      return;
    }

    if (ext !== '.dwg') {
      try { fs.unlinkSync(filePath); } catch {}
      return res.status(400).json({ success: false, message: '.dwg 또는 .dxf 파일만 업로드 가능합니다.' });
    }

    // DWG → DXF via AutoCAD
    const tempDxfPath = await convertDwgToAcadDxf(filePath);
    const dxfBuf = fs.readFileSync(tempDxfPath);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.dxf"`);
    res.send(dxfBuf);

    try { fs.unlinkSync(tempDxfPath); } catch {}
    try { fs.unlinkSync(filePath); } catch {}

  } catch (err) {
    console.error('[변환 오류]', err.message);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DWG 뷰어 업로드 (기존 기능 유지) ─────────────────────────────────────
function parseDwgBufferToDxfData(buffer) {
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const rawString = textDecoder.decode(buffer);
  const entities = [];
  const numFloats = Math.floor(buffer.byteLength / 8);
  const floatArr = new Float64Array(buffer.buffer, buffer.byteOffset, Math.min(numFloats, 1000000));

  let validLineCount = 0;
  for (let i = 0; i < floatArr.length - 3; i += 4) {
    const x1 = floatArr[i], y1 = floatArr[i + 1], x2 = floatArr[i + 2], y2 = floatArr[i + 3];
    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) continue;
    if (Math.abs(x1) < 1000 && Math.abs(y1) < 1000) continue;
    if (Math.abs(x2) < 1000 && Math.abs(y2) < 1000) continue;
    if (Math.abs(x1 - x2) < 20 && Math.abs(y1 - y2) < 20) continue;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len >= 50 && len <= 200000 && Math.abs(x1) < 3000000 && Math.abs(y1) < 3000000) {
      entities.push({ type: 'LINE', layer: 'DWG_HVAC_LAYER', color: (validLineCount % 7) + 1,
        vertices: [{ x: x1, y: y1, z: 0 }, { x: x2, y: y2, z: 0 }] });
      validLineCount++;
      if (validLineCount >= 25000) break;
    }
  }

  const koreanMatches = rawString.match(/[\uAC00-\uD7A3]{2,}/g) || [];
  let cx = -1000, cy = 1000;
  koreanMatches.forEach(str => {
    const s = str.trim();
    if (s.length >= 2) {
      cx += 500; if (cx > 1000) { cx = -1000; cy -= 300; }
      entities.push({ type: 'TEXT', layer: 'TEXT', text: s, position: { x: cx, y: cy, z: 0 }, height: 180, color: 7 });
    }
  });

  return {
    tables: { layer: { layers: { '0': { name: '0', color: 7 }, 'DWG_HVAC_LAYER': { name: 'DWG_HVAC_LAYER', color: 3 }, 'TEXT': { name: 'TEXT', color: 2 } } } },
    entities, blocks: {}
  };
}

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '업로드된 파일이 없습니다.' });

  const filePath   = req.file.path;
  const origName   = req.file.originalname;
  const ext        = path.extname(origName).toLowerCase();
  const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(2);

  console.log(`[서버] 도면 수신: ${origName} (${fileSizeMb} MB)`);

  try {
    if (ext === '.dxf') {
      const dxfContent = fs.readFileSync(filePath, 'utf-8');
      const parser = new DxfParser();
      const dxfData = parser.parseSync(dxfContent);
      try { fs.unlinkSync(filePath); } catch {}
      return res.json({ success: true, fileName: origName, fileType: 'dxf', fileSizeMb, data: dxfData });
    }

    if (ext === '.dwg') {
      let dxfData = null;

      // 1. AutoCAD 엔진으로 변환 시도
      try {
        const tempDxfPath = await convertDwgToAcadDxf(filePath);
        const dxfContent  = fs.readFileSync(tempDxfPath, 'utf-8');
        const parser      = new DxfParser();
        dxfData           = parser.parseSync(dxfContent);
        try { fs.unlinkSync(tempDxfPath); } catch {}
        console.log('[서버] AutoCAD 변환 성공!');
      } catch (acadErr) {
        console.log('[서버] AutoCAD 미설치 또는 클라우드 환경, 버퍼 파서로 fallback');
      }

      // 2. 버퍼 파서 fallback
      if (!dxfData) {
        const fileBuffer = fs.readFileSync(filePath);
        dxfData = parseDwgBufferToDxfData(fileBuffer);
        console.log(`[서버] 버퍼 파서 완료 (객체: ${dxfData.entities.length}개)`);
      }

      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}

      return res.json({ success: true, fileName: origName, fileType: 'dwg', fileSizeMb, data: dxfData });
    }

    try { fs.unlinkSync(filePath); } catch {}
    return res.status(400).json({ success: false, message: '지원하지 않는 파일 형식입니다.' });

  } catch (err) {
    console.error('[서버 오류]', err);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🚀 DWG/DXF 변환 & 뷰어 서버 (포트: ${PORT})`);
  console.log(`🔗 http://localhost:${PORT}`);
  console.log(`=========================================`);
});
