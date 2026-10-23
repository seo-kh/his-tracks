<<<<<<< HEAD
# His Tracks

His Tracks는 여러 오디오 파일을 하나의 재생 목록에서 동시에 재생하고 믹싱할 수 있는 모바일 중심의 멀티 트랙 오디오 플레이어입니다.

iOS와 Android의 가로 화면 사용을 기준으로 설계했으며, Logic Pro 스타일의 다크 인터페이스와 채널 스트립 기반 조작 방식을 사용합니다.

## 주요 기능

### 재생 목록

- 재생 목록 생성, 이름 변경 및 삭제
- 이름순 또는 생성 날짜순 정렬
- 반응형 그리드 레이아웃
- 재생 목록별 트랙과 오디오 파일 복원

### 멀티 트랙 플레이어

- 다중 오디오 파일 동시 재생
- 재생, 일시 정지, 정지 및 타임라인 탐색
- 트랙별 음소거, 솔로 및 볼륨 조절
- 전체 트랙 음소거 및 솔로
- Web Audio API 기반 실시간 레벨 미터
- Long press 후 드래그를 이용한 트랙 순서 변경
- 트랙 전체 선택 및 선택 삭제
- 시스템 파일 선택기를 이용한 로컬 오디오 가져오기
- iOS 물리 음소거 스위치 환경을 고려한 오디오 세션 처리

### Google Drive

- Google OAuth 2.0 로그인
- Google Drive API v3 기반 폴더 탐색
- 오디오 파일 다중 선택
- 파일별 다운로드 진행률 표시
- 시스템 저장 위치 선택
- 다운로드 완료 후 즉시 재생 여부 선택
- 로컬 개발용 Mock Drive 지원

### 모바일 환경

- 가로 화면 사용 안내 및 화면 방향 잠금 시도
- 확대 및 축소 제스처 방지
- iOS safe area 대응
- 터치 환경에 맞춘 버튼과 채널 스트립

## 기술 스택

- React 19
- TypeScript 5
- Vite 8
- Tailwind CSS 4
- Web Audio API
- IndexedDB
- localStorage
- File System Access API
- Google OAuth 2.0
- Google Drive API v3

별도의 애플리케이션 데이터베이스는 사용하지 않습니다.

## 시작하기

### 요구 사항

- Node.js 22
- pnpm 10

프로젝트의 권장 도구 버전은 `.mise.toml`에 정의되어 있습니다.

### 설치

```bash
pnpm install
```

### 개발 서버

```bash
pnpm dev
```

기본 Vite 개발 서버 포트는 환경에 따라 결정됩니다. Figma Make 환경에서는 개발 서버가 자동으로 시작되므로 별도로 실행하지 않아도 됩니다.

### 프로덕션 빌드

```bash
pnpm build
```

빌드 결과는 `dist/`에 생성됩니다.

### 빌드 결과 미리보기

```bash
pnpm preview
```

### 포맷

```bash
pnpm format
```

### TypeScript 검사

별도 package script는 없으며 다음 명령으로 검사할 수 있습니다.

```bash
pnpm exec tsc --noEmit
```

## 환경 변수

프로젝트 루트에 `.env.local` 등의 환경 파일을 만들 수 있습니다. `.env*` 파일은 Git에서 제외됩니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_GOOGLE_DRIVE_MOCK` | 개발 환경에서 활성화 | `false`로 설정하면 로컬 Mock Drive를 비활성화합니다. |
| `VITE_GOOGLE_CLIENT_ID` | 빈 문자열 | 개발 환경에서 실제 Google OAuth 팝업 로그인을 사용할 때 필요한 OAuth Client ID입니다. |
| `VITE_USE_SERVER` | `false` | `true`이면 `/auth/google`, `/auth/logout` 서버 엔드포인트를 이용하는 OAuth 흐름을 사용합니다. |

### Mock Drive 사용

개발 환경에서는 기본적으로 Mock Drive가 활성화됩니다.

```env
VITE_GOOGLE_DRIVE_MOCK=true
```

Mock Drive에서는 실제 Google 로그인 없이 폴더 탐색, 파일 선택 및 다운로드 흐름을 테스트할 수 있습니다.

### 실제 Google OAuth 사용

개발 환경에서 실제 Google 계정으로 로그인하려면 Mock Drive를 끄고 OAuth Client ID를 설정합니다.

```env
VITE_GOOGLE_DRIVE_MOCK=false
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

Google Cloud Console의 승인된 JavaScript 원본과 리디렉션 URI에는 실제 개발 주소를 등록해야 합니다. 팝업 OAuth 콜백 페이지는 다음 경로에 있습니다.

```text
/oauth/callback.html
```

요청 범위는 읽기 전용 Google Drive 범위입니다.

```text
https://www.googleapis.com/auth/drive.readonly
```

`VITE_USE_SERVER=true` 또는 프로덕션 모드에서는 앱이 다음 서버 경로가 존재한다고 가정합니다.

```text
GET /auth/google
GET /auth/logout
```

해당 OAuth 서버 구현은 현재 프런트엔드 소스에 포함되어 있지 않으므로 배포 환경에서 별도로 제공해야 합니다.

## 화면별 HTML 엔트리

서버에서 각 화면으로 직접 이동할 수 있도록 다음 HTML 엔트리를 제공합니다.

| URL | 화면 | 파라미터 |
| --- | --- | --- |
| `/` | 기본 앱 | 없음 |
| `/playlist/` | 재생 목록 | 없음 |
| `/player/` | 멀티 트랙 플레이어 | `playlistId` |
| `/cloud/` | 클라우드 연결 | `playlistId` |

플레이어와 클라우드 화면은 다음과 같이 특정 재생 목록을 지정할 수 있습니다.

```text
/player/?playlistId=<playlist-id>
/cloud/?playlistId=<playlist-id>
```

클라우드 화면에서 `playlistId`를 생략하면 첫 번째 재생 목록을 사용합니다. 저장된 재생 목록이 없다면 `클라우드 가져오기` 재생 목록을 자동으로 생성합니다.

## 데이터 저장 방식

### localStorage

다음과 같은 가벼운 메타데이터를 저장합니다.

- 재생 목록 ID, 이름 및 생성 시간
- 재생 목록별 트랙 이름과 순서
- 트랙 파일명과 표시 경로
- 음소거 및 솔로 상태
- 볼륨과 트랙 색상

### sessionStorage

Google OAuth 액세스 토큰과 만료 정보는 현재 브라우저 탭의 `sessionStorage`에 저장합니다. 탭 세션이 종료되거나 사용자가 로그아웃하면 저장된 인증 정보가 제거됩니다.

### IndexedDB

오디오 파일 Blob은 `his-tracks-audio` IndexedDB에 저장합니다.

재생 목록에 다시 진입하면 IndexedDB의 파일과 localStorage의 트랙 메타데이터를 결합한 뒤 Web Audio API로 디코딩합니다.

### 시스템 파일 저장

Google Drive에서 받은 파일은 지원되는 환경에서 File System Access API를 통해 사용자가 선택한 위치에 저장됩니다.

- `showDirectoryPicker`를 지원하면 디렉토리를 선택합니다.
- 디렉토리 선택을 지원하지 않고 `showSaveFilePicker`를 지원하면 파일별 저장 위치를 선택합니다.
- 두 API를 모두 지원하지 않으면 공개 저장 위치 선택을 진행할 수 없습니다.

## 프로젝트 구조

```text
.
├── public/
│   └── oauth/
│       └── callback.html
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── config/
│   │   └── vite-env.d.ts
│   ├── imports/
│   │   └── ...
│   ├── screens/
│   │   ├── cloud/
│   │   │   ├── CloudConnectScreen.tsx
│   │   │   └── components/
│   │   ├── player/
│   │   │   ├── PlayerScreen.tsx
│   │   │   ├── playerUtils.ts
│   │   │   └── components/
│   │   └── playlist/
│   │       ├── PlaylistScreen.tsx
│   │       └── components/
│   ├── services/
│   │   ├── audio/
│   │   │   └── audioStorage.ts
│   │   └── cloud/
│   │       ├── googleDrive.ts
│   │       └── mockGoogleDrive.ts
│   ├── shared/
│   │   └── types.ts
│   └── styles/
│       └── index.css
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 주요 모듈

### `src/app/App.tsx`

- 앱 전역 화면 전환
- 재생 목록 상태 관리
- 가로 화면 잠금 시도
- 확대 및 축소 방지

### `src/screens/playlist`

- 재생 목록 그리드
- 생성, 이름 변경, 삭제 및 정렬 UI

### `src/screens/player`

- 플레이어 화면과 트랜스포트 바
- Web Audio API 재생 처리
- 채널 스트립, 레벨 미터 및 트랙 순서 변경
- 트랙 선택 삭제

### `src/screens/cloud`

- 로컬 파일 추가 시트
- Google Drive 연결과 파일 탐색
- 저장 위치 확인 및 다운로드 진행 화면

### `src/services/audio/audioStorage.ts`

- IndexedDB 오디오 파일 저장과 복원
- 트랙 메타데이터 저장
- 재생 목록 또는 선택 파일 삭제

### `src/services/cloud/googleDrive.ts`

- Google OAuth 처리
- Drive 파일 및 폴더 조회
- 파일 다운로드
- File System Access API 저장 처리

## 지원 및 제약사항

- Web Audio API와 IndexedDB를 지원하는 최신 브라우저가 필요합니다.
- File System Access API는 브라우저와 운영체제에 따라 지원 범위가 다릅니다.
- iOS Safari에서는 디렉토리 선택과 파일 저장 동작이 제한될 수 있습니다.
- 화면 방향 잠금 API는 브라우저 정책에 따라 거부될 수 있으며, 이 경우 세로 화면 안내 UI가 표시됩니다.
- 브라우저 저장소를 삭제하면 저장된 재생 목록 메타데이터와 오디오 파일이 함께 사라질 수 있습니다.
- Google Drive 연동에는 Google Cloud Console의 OAuth 및 Drive API 설정이 필요합니다.
=======
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
>>>>>>> origin/master
