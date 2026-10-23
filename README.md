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
