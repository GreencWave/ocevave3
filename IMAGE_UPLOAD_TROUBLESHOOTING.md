# 이미지 업로드 문제 해결 가이드

## 현재 상태 ✅

### 코드 설정 완료
- ✅ R2 바인딩 설정 완료 (wrangler.toml)
- ✅ 이미지 업로드 API 구현 완료
- ✅ 대용량 이미지 지원 (R2: 50MB, DB: 10MB)
- ✅ 자동 폴백 시스템 (R2 → D1 데이터베이스)

### 배포 완료
- ✅ 최신 코드 Cloudflare Pages 배포 완료
- ✅ 프로덕션 URL: https://fabf91b6.ocevave.pages.dev
- ✅ D1 데이터베이스 바인딩 완료

## R2 활성화 전 vs 후

### 현재 상태 (R2 미활성화)
```
이미지 업로드 → D1 데이터베이스 저장 (base64)
파일 크기 제한: 10MB
저장 위치: D1 images 테이블
```

### R2 활성화 후
```
이미지 업로드 → R2 Storage 우선 저장
파일 크기 제한: 50MB
저장 위치: R2 버킷 (ocevave-images)
폴백: R2 실패 시 자동으로 D1 데이터베이스 사용
```

## R2 활성화 단계

### 1단계: Cloudflare Dashboard에서 R2 활성화

1. **Dashboard 접속**
   - URL: https://dash.cloudflare.com
   - 로그인

2. **R2 활성화**
   - 왼쪽 메뉴 → **R2** 클릭
   - **Enable R2** 버튼 클릭
   - 결제 정보 입력 (필요 시)
   
   **가격 정보:**
   - 첫 10GB/월: **무료**
   - 추가 스토리지: $0.015/GB/월
   - Class A Operations (write): 첫 100만 요청 무료
   - Class B Operations (read): 첫 1000만 요청 무료

### 2단계: R2 버킷 생성

터미널에서 실행:
```bash
cd /home/user/webapp
npx wrangler r2 bucket create ocevave-images
```

**예상 출력:**
```
✨ Successfully created R2 bucket 'ocevave-images'
```

### 3단계: Cloudflare Pages에 R2 바인딩 추가

1. **Dashboard 이동**
   - Pages → ocevave → Settings → Functions

2. **R2 Bucket Bindings 섹션**
   - **Add binding** 클릭
   - Variable name: `R2`
   - R2 bucket: `ocevave-images` (드롭다운에서 선택)
   - **Save** 클릭

3. **재배포**
   - **Deployments** 탭으로 이동
   - 최신 배포에서 **Retry deployment** 클릭
   - 또는 터미널에서:
     ```bash
     cd /home/user/webapp
     npm run build
     npx wrangler pages deploy dist --project-name ocevave
     ```

### 4단계: 테스트

1. **관리자 페이지 접속**
   - URL: https://fabf91b6.ocevave.pages.dev/admin
   - 이메일: admin@ocevave
   - 비밀번호: admin123

2. **대용량 이미지 업로드 테스트**
   - 상품 추가 → 이미지 선택 (최대 50MB)
   - 이미지 미리보기 확인
   - 저장 버튼 클릭
   - 상품 목록에서 이미지 확인

3. **콘솔 로그 확인 (F12)**
   ```
   R2 활성화 시: "Image uploaded to R2 successfully"
   R2 미활성화 시: "R2 not available, using database storage"
   ```

## 문제 해결

### 문제 1: 이미지가 업로드되지 않음

**증상:**
- 업로드 버튼 클릭 시 오류 메시지
- 콘솔에 "Image upload failed" 에러

**해결 방법:**
1. **파일 크기 확인**
   - R2 활성화: 최대 50MB
   - R2 미활성화: 최대 10MB
   - 파일 크기 초과 시 압축 필요

2. **파일 형식 확인**
   - 지원 형식: JPG, PNG, GIF, WebP
   - 다른 형식은 변환 필요

3. **브라우저 캐시 삭제**
   ```
   Ctrl+Shift+Delete → 캐시 삭제
   또는 Ctrl+F5 (하드 리로드)
   ```

4. **최신 배포 URL 사용**
   - 최신: https://fabf91b6.ocevave.pages.dev
   - 이전 URL은 작동하지 않을 수 있음

### 문제 2: R2 활성화 실패

**증상:**
- `npx wrangler r2 bucket create` 실행 시 에러
- Error 10042: "R2 is not enabled"

**해결 방법:**
1. Dashboard에서 R2 Enable 버튼 클릭 필요
2. 결제 정보 입력 (신용카드 필요, 첫 10GB 무료)
3. 활성화 후 다시 버킷 생성 명령 실행

### 문제 3: 이미지가 표시되지 않음

**증상:**
- 업로드 성공했지만 이미지가 보이지 않음
- 이미지 URL은 `/api/images/xxxxx.png`

**해결 방법:**
1. **콘솔 확인 (F12 → Network)**
   - 이미지 요청 상태 확인
   - 404: 이미지가 저장되지 않음
   - 500: 서버 오류

2. **D1 바인딩 확인**
   - Dashboard → Pages → ocevave → Settings → Functions
   - D1 Database Bindings에 `DB` 변수 확인
   - 없으면 추가 필요

3. **R2 바인딩 확인 (R2 활성화한 경우)**
   - R2 Bucket Bindings에 `R2` 변수 확인
   - 버킷 이름: `ocevave-images`

### 문제 4: 10MB 이상 이미지 업로드 실패

**증상:**
- 10MB 이상 파일 업로드 시 "이미지 크기는 10MB 이하여야 합니다" 에러

**원인:**
- R2가 활성화되지 않아 D1 데이터베이스를 사용 중
- D1은 최대 10MB 제한

**해결 방법:**
1. **R2 활성화** (위 2단계 참조)
2. **또는 이미지 압축**
   - 온라인 도구: https://tinypng.com
   - 품질 손실 없이 파일 크기 50-70% 감소

## 현재 작동 방식

### 이미지 업로드 플로우

```
사용자가 이미지 선택
      ↓
파일 크기 확인
  - R2 활성화: 50MB 이하
  - R2 미활성화: 10MB 이하
      ↓
고유 파일명 생성
(timestamp-random.ext)
      ↓
R2 업로드 시도 (R2 활성화 시)
      ↓
  성공 → R2에 저장
      ↓
  실패 → D1 데이터베이스에 base64로 저장
      ↓
URL 반환: /api/images/xxxxx.png
      ↓
프론트엔드에서 이미지 표시
```

### 이미지 조회 플로우

```
GET /api/images/xxxxx.png
      ↓
R2에서 조회 시도 (R2 활성화 시)
      ↓
  성공 → R2에서 이미지 반환
      ↓
  실패 → D1 데이터베이스에서 조회
      ↓
이미지 반환 (Content-Type, Cache-Control 헤더 포함)
```

## 추천 사항

### R2 활성화를 권장하는 경우
- 고해상도 이미지 (10MB 이상)
- 많은 이미지 업로드 예상
- 빠른 로딩 속도 필요
- 장기 운영 계획

### D1만 사용해도 괜찮은 경우
- 소량 이미지 (각 10MB 이하)
- 테스트/개발 환경
- 비용 절감 우선

## 연락처

문제가 계속되면:
1. GitHub Issues: https://github.com/GreencWave/ocevave3/issues
2. 콘솔 로그 (F12) 스크린샷 첨부
3. 에러 메시지 전체 복사
