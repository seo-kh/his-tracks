# 🎵 His Tracks

> **Web Audio API 기반 멀티트랙 오디오 믹서 & 플레이리스트 웹 애플리케이션**  
> Google Drive 연동, 실시간 오디오 채널 제어, 그리고 Express와 React가 통합된 모던 풀스택 아키텍처를 제공합니다.

---

## 📖 1. 프로젝트 개요 (Overview)

**His Tracks**는 브라우저 환경에서 멀티트랙 음원을 재생하고 믹싱할 수 있는 웹 기반 오디오 워크스테이션/플레이어입니다.  
사용자는 Google Drive에서 자신의 오디오 트랙을 불러와 플레이리스트를 구성하고, 각 트랙별 볼륨 fader, Mute, Solo 등의 채널 스트립을 제어하며 실시간 오디오 믹싱을 경험할 수 있습니다.

### ✨ 주요 기능
- **🎛️ 멀티트랙 오디오 믹서**:
  - Web Audio API(`AudioContext`, `GainNode`, `AnalyserNode`) 기반의 실시간 다중 음원 재생 및 동기화
  - 트랙별 볼륨 조절, Mute(음소거), Solo(독주) 제어
  - 드래그 앤 드롭을 통한 트랙 순서 재배치 및 오디오 파형 분석
- **☁️ Google Drive 연동**:
  - Google OAuth 2.0(PKCE 및 백엔드 토큰 교환)을 통한 안전한 클라우드 인증
  - Google Drive 파일 탐색기를 통해 오디오 파일(.wav, .mp3, .flac, .m4a 등) 직접 불러오기 및 다운로드
- **📑 플레이리스트 관리**:
  - 다중 플레이리스트 생성, 이름 수정, 삭제 및 이름순/날짜순 정렬
- **⚡ 통합 풀스택 아키텍처**:
  - Express 백엔드와 React 19 프론트엔드가 단일 프로젝트로 유기적으로 통합
  - 개발 환경에서는 Express가 Vite dev middleware를 호스팅하여 하나의 포트(`3000`)에서 HMR과 API를 동시에 제공
  - 프로덕션 및 Vercel 호스팅에 최적화된 서버리스 구조 지원

---

## 🛠️ 2. 기술 스택 (Tech Stack)

| 영역 | 기술 스택 | 설명 |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4 | 고성능 UI 컴포넌트 및 즉각적인 HMR 지원 |
| **Audio Engine** | Web Audio API | 멀티 채널 오디오 디코딩, 게인 제어 및 애널라이저 |
| **Backend** | Express, Node.js, Axios, tsx | Google OAuth 2.0 인증, API 라우팅 및 정적 SPA 서빙 |
| **Hosting** | Vercel | 글로벌 Edge CDN (React SPA) + Serverless Function (Express) |

---

## 📁 3. 디렉터리 구조 (Directory Structure)

```text
his-tracks/
├── api/
│   └── index.ts            # Vercel Serverless Function 진입점 (Express 앱 핸들러)
├── server/
│   ├── src/
│   │   ├── app.ts          # Express 앱 설정 (CORS, 바디 파서, /auth, /health 라우트)
│   │   ├── auth.ts         # Google OAuth 2.0 인증 로직 (동의 화면 리다이렉트 및 토큰 교환)
│   │   └── index.ts        # 독립 실행 서버 진입점 (Vite HMR 미들웨어 또는 dist 정적 서빙)
│   └── tsconfig.json       # 서버 TypeScript 컴파일 설정
├── src/                    # React 프론트엔드 소스코드
│   ├── App.tsx             # 메인 앱 컴포넌트 (믹서, 플레이어, 플레이리스트)
│   ├── googleDrive.ts      # Google Drive API v3 및 클라이언트 인증 모듈
│   ├── main.tsx            # React 렌더 진입점
│   └── index.css           # 글로벌 스타일 (Tailwind CSS)
├── public/                 # 정적 리소스 및 OAuth 콜백 페이지
│   └── oauth/
│       └── callback.html   # OAuth 팝업 처리 콜백
├── index.html              # Vite SPA 템플릿
├── vite.config.ts          # Vite 빌드 설정 (백엔드 프록시 및 플러그인)
├── vercel.json             # Vercel 서버리스 라우팅 및 빌드 설정
├── tsconfig.json           # 전체 프로젝트 통합 TypeScript 설정
├── package.json            # 통합 프로젝트 의존성 및 실행 스크립트
└── .env.example            # 로컬 및 배포용 환경 변수 템플릿
```

---

## 🔄 4. 실행 및 동작 구조

### 1) 개발 환경 (`npm run dev`)
- Express 서버가 실행되어 `http://localhost:3000`에서 대기합니다.
- Express 내부에 **Vite Dev Server Middleware**가 마운트되어 별도의 Vite 프로세스 없이도 실시간 코드 변경 사항(HMR)이 즉시 반영됩니다.
- `/auth/google`, `/health` 등 모든 API와 프론트엔드 라우팅이 동일한 오리진(`localhost:3000`)에서 동작하므로 CORS 설정이 단순해집니다.

### 2) 프로덕션 로컬 환경 (`npm start`)
- `npm run build`를 통해 `dist/`에 React 정적 빌드 파일이 생성됩니다.
- Express 서버가 실행되며 `dist/`의 정적 파일을 서빙하고, SPA 라우팅 폴백(`index.html`)을 제공합니다.

### 3) Vercel 호스팅 환경
- **프론트엔드 정적 서빙**: Vercel의 글로벌 Edge CDN에서 `dist/` 빌드 결과를 초저지연으로 캐싱 및 서빙합니다.
- **백엔드 서버리스 처리**: `vercel.json`의 리라이트 규칙에 따라 `/auth/*`, `/health`, `/api/*` 요청은 `api/index.ts`를 통해 Vercel Serverless Function(Express)으로 자동 라우팅됩니다.

---

## ⚙️ 5. 환경 변수 설정 (.env)

프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 입력합니다 (자세한 내용은 [.env.example](.env.example) 참고):

```env
# ── Server ────────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ── Google OAuth 2.0 ──────────────────────────────────────────────────────────
# Google Cloud Console > API 및 서비스 > 사용자 인증 정보 > OAuth 2.0 클라이언트 ID
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Google Cloud Console의 "승인된 리디렉션 URI"에 등록한 주소와 정확히 일치해야 합니다:
# - 로컬 개발: http://localhost:3000/auth/google/callback
# - Vercel 배포: https://<your-project-name>.vercel.app/auth/google/callback
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# ── Client Redirect ───────────────────────────────────────────────────────────
CLIENT_REDIRECT_URL=/
CLIENT_ORIGIN=http://localhost:3000

# ── Frontend (Vite) ───────────────────────────────────────────────────────────
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

> **Google Cloud Console 설정 팁**:
> 1. [Google Cloud Console](https://console.cloud.google.com/) 접속 후 새 프로젝트 생성
> 2. **API 및 서비스 > 라이브러리**에서 `Google Drive API` 활성화
> 3. **사용자 인증 정보**에서 `OAuth 2.0 클라이언트 ID` 생성 (애플리케이션 유형: **웹 애플리케이션**)
> 4. **승인된 자바스크립트 원본**: `http://localhost:3000`, 배포 도메인 URL 추가
> 5. **승인된 리디렉션 URI**: `http://localhost:3000/auth/google/callback`, `http://localhost:3000/oauth/callback`, 배포 도메인의 콜백 URL 추가

---

## 🚀 6. 시작하기 (Quick Start)

### 1) 의존성 설치
```bash
npm install
```

### 2) 통합 개발 서버 실행 (추천)
서버를 켜면 React 앱이 함께 실행됩니다:
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`으로 접속합니다.

### 3) 프로덕션 빌드 및 로컬 테스트
```bash
# 1. React 프론트엔드 빌드
npm run build

# 2. 프로덕션 정적 서빙 서버 시작
npm start
```

### 4) 기타 스크립트
- `npm run dev:client`: Vite 독립 개발 서버 실행 (`http://localhost:5173`)
- `npm run dev:server`: Express 독립 백엔드 서버 실행 (`http://localhost:3000`)
- `npm run preview`: 빌드된 프론트엔드 미리보기

---

## 🌐 7. Vercel 배포 가이드 (Vercel Deployment)

1. GitHub 저장소에 코드를 커밋하고 푸시합니다:
   ```bash
   git add .
   git commit -m "feat: integrate Express and React for Vercel deployment"
   git push origin main
   ```
2. [Vercel](https://vercel.com/) 대시보드에서 **Add New > Project**를 선택하고 저장소를 임포트합니다.
3. Vercel이 프레임워크 프리셋으로 **Vite**를 자동 감지합니다:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables** 항목에 `.env`에 정의된 값들을 등록합니다:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL` (`https://<your-vercel-domain>.vercel.app/auth/google/callback`)
   - `CLIENT_REDIRECT_URL` (`/`)
   - `VITE_GOOGLE_CLIENT_ID`
5. **Deploy** 버튼을 누르면 배포가 완료됩니다!
   - Google Cloud Console의 리디렉션 URI 목록에 배포된 Vercel 도메인 URL을 반드시 추가해주세요.
