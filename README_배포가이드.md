# 🌐 깃허브(GitHub) 웹 배포 및 웹 링크(URL) 생성 가이드

본 도면 뷰어 프로젝트를 깃허브(GitHub)에 업로드하고, **누구나 URL 주소만 클릭하면 웹 브라우저에서 바로 사용할 수 있도록 무료로 배포하는 2가지 방법**입니다.

---

## 1단계: 깃허브(GitHub) 리포지토리 생성 및 코드 올리기

1. **깃허브 로그인**: [https://github.com](https://github.com) 에 로그인합니다.
2. **새 리포지토리 생성**:
   - 우측 상단 `+` 버튼 -> **`New repository`** 클릭
   - Repository name: `dwg-3d-viewer` (원하는 이름 입력)
   - Public 선택 후 **`Create repository`** 클릭
3. **내 컴퓨터 터미널에서 코드 푸시(Upload)**:
   - 프로젝트 폴더(`c:\Users\강주영\Desktop\a1`)에서 다음 명령어 3줄을 순서대로 실행합니다:

```bash
git remote add origin https://github.com/본인_깃허브_아이디/dwg-3d-viewer.git
git branch -M main
git push -u origin main
```

---

## 2단계: 웹 접속용 무료 URL 배포하기 (추천: Render.com 100% 무료 서버)

백엔드 서버(`server.js`)가 포함되어 대용량 `.dwg` 및 `.dxf` 변환과 300 DPI 플롯 기능 전체를 영구적인 웹 주소(`https://...`)로 배포하는 최적의 방법입니다.

1. **Render 서비스 접속**: [https://render.com](https://render.com) 접속 후 무료 회원가입
2. **웹 서비스 생성**:
   - 대시보드에서 **`New +`** -> **`Web Service`** 클릭
   - 깃허브 계정 연동 후 방금 올린 `dwg-3d-viewer` 리포지토리 선택
3. **설정값 입력**:
   - **Name**: `dwg-3d-viewer` (원하는 URL 이름)
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free` 선택
4. **`Create Web Service` 클릭!**
   - 1~2분 후 Render에서 고유 웹 접속 주소를 생성해 줍니다!
   - 예: **`https://dwg-3d-viewer.onrender.com`**

👉 **이제 이 URL 주소만 이메일이나 카카오톡으로 전달하면 누구나 설치 없이 접속해서 사용 가능합니다!**

---

## 3단계: GitHub Pages로 정적 웹페이지 1초 배포하기 (선택 사항)

`.dxf` 도면 전용 및 뷰어 화면만 깃허브 주소(`github.io`)로 배포하고 싶을 때 사용합니다.

1. 깃허브 리포지토리 페이지 상단 **`Settings`** 탭 클릭
2. 좌측 메뉴에서 **`Pages`** 클릭
3. **`Build and deployment`** -> Source를 **`Deploy from a branch`** 선택
4. Branch: **`main`**, Folder: **`/public`** (또는 `/root`) 선택 후 **`Save`** 클릭
5. 1분 후 깃허브 상단에 생성된 웹 링크 클릭!
   - 예: **`https://본인_아이디.github.io/dwg-3d-viewer/public`**
