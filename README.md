# OCEVAVE

**바다의 미래를 다시 씁니다**

## 프로젝트 개요

OCEVAVE는 해양 환경 보호를 위한 실질적인 행동을 이끄는 기업 웹사이트입니다.
환경 보호, 책임 있는 소비, 창조세계 보전이라는 가치관을 실천하며,
친환경 굿즈 판매와 해양 보호 활동을 통해 깨끗한 바다를 만들어갑니다.

## 주요 기능

### ✅ 완료된 기능

1. **홈페이지**
   - 풀스크린 Hero Section with 애니메이션
   - 회사 미션 소개
   - 반응형 디자인

2. **해양 위기 페이지**
   - 해양 오염, 기후 변화, 생태계 파괴 정보
   - 카드형 레이아웃
   - 패럴랙스 효과

3. **친환경 굿즈 쇼핑**
   - 6종 상품 (텀블러, 에코백, 칫솔, 비누, 모자, 스티커)
   - 장바구니 기능 (LocalStorage)
   - 주문 및 결제 플로우
   - 주문 완료 페이지

4. **활동 & 이벤트**
   - 해양 보호 활동 목록
   - 이벤트 목록
   - 가상 데이터 자동 생성

5. **회원 인증**
   - 회원가입 (이메일 중복 체크)
   - 로그인/로그아웃
   - 비밀번호 해싱 (PBKDF2)
   - 세션 관리 (Cookie 기반)

6. **관리자 시스템**
   - 관리자 전용 페이지
   - 하드코딩된 관리자 계정
   - 상품/이벤트/활동 관리 UI

7. **기타**
   - 404 커스텀 페이지
   - 반응형 헤더/푸터
   - 모바일 햄버거 메뉴
   - 장바구니 배지

## 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, TailwindCSS
- **Backend**: Hono (Cloudflare Workers)
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: Cloudflare Pages
- **Version Control**: Git & GitHub
- **Process Management**: PM2

## 프로젝트 구조

```
webapp/
├── src/
│   ├── index.tsx          # 메인 애플리케이션
│   ├── types.ts           # TypeScript 타입 정의
│   ├── utils.ts           # 유틸리티 함수
│   ├── middleware.ts      # 인증 미들웨어
│   └── admin-config.ts    # 관리자 설정
├── migrations/
│   └── 0001_initial_schema.sql  # D1 데이터베이스 스키마
├── seed.sql               # 초기 데이터
├── ecosystem.config.cjs   # PM2 설정
├── wrangler.jsonc         # Cloudflare 설정
├── package.json           # 의존성 및 스크립트
└── README.md              # 프로젝트 문서
```

## 데이터베이스 구조

### Tables
- **users**: 회원 정보 (이메일, 이름, 비밀번호 해시)
- **products**: 상품 정보 (이름, 설명, 가격, 재고)
- **orders**: 주문 정보 (주문번호, 배송지, 결제 상태)
- **order_items**: 주문 상품 상세
- **events**: 이벤트 정보
- **activities**: 활동 정보

## 로컬 개발

### 1. 의존성 설치
```bash
npm install
```

### 2. D1 데이터베이스 초기화
```bash
npm run db:migrate:local  # 마이그레이션
npm run db:seed           # 초기 데이터 추가
```

### 3. 개발 서버 시작
```bash
npm run build             # 빌드
pm2 start ecosystem.config.cjs  # PM2로 시작
```

### 4. 서버 확인
```bash
curl http://localhost:3000
```

## 관리자 계정

**⚠️ 중요: 관리자 계정은 하드코딩되어 있습니다**

- **이메일**: admin@ocevave
- **비밀번호**: admin123

관리자 계정으로는 일반 회원가입이 불가능하며, 로그인 시 자동으로 관리자 권한이 부여됩니다.

## 배포

### GitHub
- **Repository**: https://github.com/GreencWave/ocevave3

### Cloudflare Pages
```bash
npm run deploy:prod
```

## URLs

- **샌드박스**: https://3000-i7ysvrwxpv4r8fh1v9avf-2e1b9533.sandbox.novita.ai
- **GitHub**: https://github.com/GreencWave/ocevave3

## 초기 데이터

### 상품 (6종)
1. 스테인리스 텀블러 - 25,000원
2. 유기농 에코백 - 15,000원
3. 대나무 칫솔 세트 - 12,000원
4. 천연 비누 세트 - 18,000원
5. 리사이클 모자 - 22,000원
6. 방수 스티커 세트 - 8,000원

### 이벤트 (4개)
- 해양 정화의 날 2024
- 바다 생태계 보호 세미나
- 어린이 환경 교육 프로그램
- OCEVAVE 창립 기념 특별전

### 활동 (4개)
- 제1회 해안 쓰레기 수거 활동
- 산호초 보호 캠페인
- 플라스틱 프리 챌린지
- 해양 생태계 다큐멘터리 제작

## 보안

- ✅ 비밀번호 해싱 (PBKDF2 + Salt)
- ✅ SQL Injection 방지 (Prepared Statements)
- ✅ XSS 방지 (HTML Sanitization)
- ✅ Cookie 기반 세션 (HttpOnly, Secure, SameSite)
- ✅ 관리자 권한 체크

## 디자인 컬러

- **바다**: #1a4d5e
- **모래**: #f4e9d8
- **나뭇잎**: #5a7f5f

차분하고 신뢰감 있는 자연 계열 톤을 사용하여,
환경 보호 기업의 정체성을 은은하게 표현했습니다.

## 반응형 디자인

- **Desktop** (1024px+): 풀 네비게이션, 멀티 컬럼
- **Tablet** (768px-1023px): 레이아웃 축소
- **Mobile** (<768px): 햄버거 메뉴, 단일 컬럼

## 라이센스

Copyright © 2024 OCEVAVE. All rights reserved.

---

**"작은 실천이 모여 큰 변화를 만듭니다. 함께 바다의 미래를 다시 씁시다."**
