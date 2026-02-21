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
   - **위기 기사 페이지** ⭐ 새 기능: 관리자가 기사 추가/삭제, 이미지 파일 업로드, 카테고리별 분류

3. **친환경 굿즈 쇼핑**
   - 6종 상품 (텀블러, 에코백, 칫솔, 비누, 모자, 스티커)
   - **상품 상세 페이지**: 이미지, 설명, 재고 확인, 수량 선택
   - 장바구니 기능 (LocalStorage)
   - 주문 및 결제 플로우
   - 주문 완료 페이지

4. **활동 & 이벤트**
   - 해양 보호 활동 목록 및 **상세 페이지**
   - 이벤트 목록 및 **상세 페이지**
   - **이벤트 예약 기능**: 이름, 이메일, 전화번호, 참가 인원 입력
   - 가상 데이터 자동 생성

5. **회원 인증**
   - 회원가입 (이메일 중복 체크)
   - 로그인/로그아웃
   - 비밀번호 해싱 (PBKDF2)
   - 세션 관리 (Cookie 기반)

6. **관리자 시스템** ⭐ 완전 구현 + 이미지 업로드
   - 관리자 전용 페이지
   - 하드코딩된 관리자 계정
   - **상품 관리**: 추가, 수정, 삭제 + **이미지 파일 업로드 (DB 저장)**
   - **이벤트 관리**: 추가, 삭제 + **이미지 파일 업로드 (DB 저장)**
   - **활동 관리**: 추가, 삭제 + **이미지 파일 업로드 (DB 저장)**
   - **주문 관리**: 주문 목록 조회, **구매 상품 목록 표시** ⭐
   - **예약 관리**: 이벤트별 예약 목록 조회, 총 참가 인원 파악
   - **회원 관리**: 가입 회원 목록 조회, 관리자/일반 회원 구분
   - **후원 관리** ⭐: 정기 후원자 목록, 월 정기 후원액 통계, 활성/중단 상태 관리
   - **위기 기사 관리** ⭐ 새 기능: 기사 추가/삭제, 제목/내용/출처/링크 입력, **이미지 파일 업로드**, 카테고리 선택, 발행일 설정
   - **회사 소개 편집** ⭐ 새 기능: 미션, 비전, 핵심가치 섹션별 제목/내용 수정
   - **이미지 업로드**: 파일 선택 또는 URL 입력, 실시간 미리보기, DB base64 저장

7. **수익 사용처 페이지**
   - 투명한 수익 사용 내역 공개
   - 40% 해양 정화, 30% 생태계 보호, 20% 교육, 10% 운영

8. **정기 후원 페이지** ⭐ 완전 구현
   - 3단계 후원 등급: 씨앗(월 1만원), 파도(월 3만원), 항해(월 5만원+)
   - 직접 입력 후원 금액 선택
   - **DB 저장**: 후원자 정보와 금액 데이터베이스에 저장
   - **관리자 대시보드**: 후원자 목록, 월 정기 후원액 통계 확인
   - 후원 혜택 안내 (소식지, 활동 보고서, 할인 혜택)
   - 기부금 공제 안내

9. **기타**
   - 404 커스텀 페이지
   - 반응형 헤더/푸터
   - 모바일 햄버거 메뉴
   - 장바구니 배지

## URL 정보

### Sandbox (개발 환경)
- https://3000-i7ysvrwxpv4r8fh1v9avf-2e1b9533.sandbox.novita.ai

### Production (프로덕션 배포) ⭐ 최신 배포!
- **Live URL**: https://122eac0f.ocevave.pages.dev
- **이전 배포**: 
  - https://855bb3dd.ocevave.pages.dev
  - https://4a2929a0.ocevave.pages.dev
  - https://104ef7fb.ocevave.pages.dev
- **Cloudflare Pages Project**: ocevave
- **GitHub Repository**: https://github.com/GreencWave/ocevave3
- **배포 일시**: 2026-02-21
- **D1 바인딩**: ✅ 설정 완료! 이미지 업로드 작동
- **변경 사항**: wrangler.toml 추가, 모든 기능 정상 작동 확인

### ✅ D1 데이터베이스 바인딩 완료!

D1 데이터베이스 바인딩이 설정되어 있습니다:
- **Variable name**: `DB`
- **Database**: `ocevave-production` (d3e2fba5-2acd-4a78-a125-d4cf5ee81079)
- **상태**: ✅ 정상 작동 중

이미지 업로드, 상품 관리, 주문 관리 등 모든 데이터베이스 기능이 정상적으로 작동합니다!

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
│   ├── 0001_initial_schema.sql     # D1 초기 스키마
│   ├── 0002_add_reservations.sql   # 예약 테이블
│   ├── 0003_add_images_table.sql   # 이미지 테이블
│   ├── 0004_add_donations.sql      # 정기후원 테이블
│   ├── 0005_add_crisis_articles.sql # 위기 기사 테이블
│   └── 0006_add_company_info.sql   # 회사 소개 테이블
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
- **event_reservations**: 이벤트 예약 정보 (예약자명, 이메일, 전화번호, 참가 인원)
- **donations**: 정기 후원 정보 (후원 금액, 후원자명, 이메일, 전화번호, 상태)
- **crisis_articles** ⭐ 새 테이블: 해양 위기 기사 (제목, 내용, 출처, 링크, 이미지, 카테고리, 발행일)
- **company_info** ⭐ 새 테이블: 회사 소개 정보 (섹션, 제목, 내용)
- **images**: 업로드된 이미지 (filename, base64 data, content_type)

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

### 관리자 기능

1. **상품 관리**
   - 상품 추가: 상품명, 설명, 가격, 재고 입력
   - **이미지 업로드**: 파일 선택 (최대 5MB) 또는 URL 직접 입력
   - **실시간 미리보기**: 이미지 선택 시 즉시 미리보기
   - 상품 수정: 기존 상품 정보 변경 (이미지 재업로드 가능)
   - 상품 삭제: 확인 후 삭제
   - **저장 즉시 반영**: 상품 추가/수정 시 구매 페이지에 즉시 반영

2. **이벤트 관리**
   - 이벤트 추가: 제목, 내용, 일정, 장소 입력
   - **이미지 업로드**: 파일 선택 또는 URL 입력
   - **실시간 미리보기**: 이미지 선택 시 즉시 미리보기
   - 이벤트 삭제: 확인 후 삭제
   - **저장 즉시 반영**: 이벤트 추가/삭제 시 이벤트 페이지에 즉시 반영

3. **활동 관리**
   - 활동 추가: 제목, 내용, 날짜, 장소 입력
   - **이미지 업로드**: 파일 선택 또는 URL 입력
   - **실시간 미리보기**: 이미지 선택 시 즉시 미리보기
   - 활동 삭제: 확인 후 삭제
   - **저장 즉시 반영**: 활동 추가/삭제 시 활동 페이지에 즉시 반영

4. **주문 관리**
   - 주문 목록 조회: 주문번호, 고객명, 전화번호, 배송지, 금액, 주문일시, 상태 확인

5. **예약 관리** ⭐ 새 기능
   - 이벤트별 예약 목록 조회
   - 예약자 정보: 이름, 이메일, 전화번호, 참가 인원
   - **총 참가 인원 집계**: 이벤트별 총 참가자 수 표시
   - 예약 일시 확인

6. **회원 관리** ⭐ 새 기능
   - 가입 회원 목록 조회
   - 회원 정보: 이름, 이메일, 가입일
   - 관리자/일반 회원 구분 표시
   - 총 회원 수 통계

7. **정기 후원 관리** ⭐ 새 기능
   - 정기 후원자 목록 조회
   - 후원자 정보: 이름, 이메일, 전화번호, 월 후원액
   - **통계 대시보드**:
     - 총 후원자 수
     - 활성 후원자 수
     - 월 정기 후원액 합계
   - 후원 상태: 활성/중단 표시
   - 신청일 확인

### 이미지 업로드 기능

- ✅ **파일 선택**: 이미지 파일 직접 선택 (JPG, PNG, GIF 등)
- ✅ **파일 크기 제한**: 최대 5MB
- ✅ **실시간 미리보기**: 업로드 전 미리보기
- ✅ **URL 입력**: 파일 업로드 대신 URL 직접 입력 가능
- ✅ **데이터베이스 저장**: 로컬 환경에서 base64로 DB에 안전하게 저장
- ✅ **R2 스토리지**: Cloudflare R2에 안전하게 저장 (프로덕션)
- ✅ **자동 파일명**: timestamp + random string으로 고유한 파일명 생성
- ✅ **즉시 반영**: 저장 후 구매/이벤트/활동 페이지에 즉시 반영

## 배포

### GitHub
- **Repository**: https://github.com/GreencWave/ocevave3

### Cloudflare Pages ⭐ 배포 완료!

#### 배포 정보
- **프로젝트명**: ocevave
- **Production URL**: https://a525c4d7.ocevave.pages.dev
- **D1 Database**: ocevave-production (d3e2fba5-2acd-4a78-a125-d4cf5ee81079)
- **마이그레이션**: 모든 마이그레이션 적용 완료 (0001~0006)
- **초기 데이터**: 시드 데이터 적용 완료

#### 배포 명령어
```bash
# 빌드 및 배포
npm run build
npx wrangler pages deploy dist --project-name ocevave

# 또는 package.json 스크립트 사용
npm run deploy:prod
```

#### ⚠️ 중요: D1 바인딩 설정 필요

배포 후 Cloudflare Dashboard에서 D1 데이터베이스 바인딩을 설정해야 합니다:

1. **Cloudflare Dashboard 접속**: https://dash.cloudflare.com
2. **Pages > ocevave** 프로젝트 선택
3. **Settings > Functions** 탭
4. **D1 Database Bindings** 섹션:
   - Variable name: `DB`
   - D1 Database: `ocevave-production` 선택
5. **Save** 버튼 클릭
6. 새 배포 트리거 또는 기존 배포 재시작

바인딩 설정 후 모든 데이터베이스 기능이 정상 작동합니다.

#### 프로덕션 데이터베이스 관리

```bash
# 원격 DB 마이그레이션 적용
npx wrangler d1 migrations apply ocevave-production --remote

# 원격 DB 쿼리 실행
npx wrangler d1 execute ocevave-production --remote --command="SELECT * FROM users"

# 원격 DB에 파일 실행
npx wrangler d1 execute ocevave-production --remote --file=./seed.sql
```

## URLs

- **Production (Cloudflare Pages)** ⭐: https://a525c4d7.ocevave.pages.dev
- **Sandbox (개발)**: https://3000-i7ysvrwxpv4r8fh1v9avf-2e1b9533.sandbox.novita.ai
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
