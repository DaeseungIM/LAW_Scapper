# Law_Scapping Dashboard Prototype

법무법인 태평양(BKL) 스타일의 깔끔하고 모던한 대시보드 인터페이스를 적용한 법령/의안 스크래핑 시스템 프론트엔드 프로토타입입니다.

## 주요 기능 (UI)
- **입력 영역:** 법령/의안 URL 또는 검색어 입력, 다운로드 옵션(개정연혁, PDF/HWP) 선택 기능.
- **모니터링 영역:** 실시간 다운로드 진행률(Progress Bar) 및 상태 콘솔 로그 창.
- **결과 목록:** 수집된 법령명, 공포일자, 다운로드 링크 및 상태 배지(완료/대기/오류) 테이블.

## 기술 스택
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (BKL Navy/Gray Theme)
- **Icons:** Lucide React

## 로컬 실행 방법

1. **의존성 설치:**
   ```bash
   npm install
   ```

2. **개발 서버 실행:**
   ```bash
   npm run dev
   ```

3. **브라우저 확인:**
   출력된 주소(기본값: `http://localhost:5173`)로 접속하여 대시보드를 확인합니다.

4. **빌드:**
   ```bash
   npm run build
   ```

## 프로젝트 구조
- `src/App.tsx`: 메인 대시보드 레이아웃 및 컴포넌트 로직
- `src/index.css`: Tailwind CSS 설정 및 공통 스타일 (BKL 테마 정의)
- `tailwind.config.js`: Navy (#002C5F) 테마 컬러 커스텀 설정
