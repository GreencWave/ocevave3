# D1 데이터베이스 바인딩 설정 가이드

## 현재 상황
- ✅ D1 데이터베이스 생성됨: `ocevave-production` (d3e2fba5-2acd-4a78-a125-d4cf5ee81079)
- ✅ 마이그레이션 완료: 12개 테이블
- ✅ Cloudflare Pages 배포됨: https://4a2929a0.ocevave.pages.dev
- ❌ D1 바인딩 미설정: 이미지 업로드 및 DB 기능 작동 안 함

## 설정 방법

### 1단계: Cloudflare Dashboard 접속
https://dash.cloudflare.com 에 접속하세요.

### 2단계: Pages 프로젝트 선택
1. 왼쪽 메뉴에서 **Workers & Pages** 클릭
2. **ocevave** 프로젝트 클릭

### 3단계: Settings로 이동
1. 상단 탭에서 **Settings** 클릭
2. 왼쪽 사이드바에서 **Functions** 클릭

### 4단계: D1 Database Bindings 추가
1. **D1 database bindings** 섹션 찾기
2. **Add binding** 버튼 클릭
3. 다음 정보 입력:
   - **Variable name**: `DB` (정확히 대문자로)
   - **D1 database**: `ocevave-production` 선택
4. **Save** 버튼 클릭

### 5단계: 재배포 (중요!)
바인딩을 추가한 후 **반드시 재배포**해야 적용됩니다:

**옵션 A: 자동 재배포**
1. **Deployments** 탭으로 이동
2. 최신 배포 옆 **...** 메뉴 클릭
3. **Retry deployment** 선택

**옵션 B: 새 배포 트리거**
```bash
cd /home/user/webapp
npx wrangler pages deploy dist --project-name ocevave
```

## 확인 방법

바인딩 설정 후:
1. https://4a2929a0.ocevave.pages.dev/admin 접속
2. 관리자 로그인: admin@ocevave / admin123
3. **상품 관리** 탭 클릭
4. **상품 추가** 클릭
5. 이미지 파일 업로드 시도
6. ✅ 성공하면 이미지가 미리보기에 표시됩니다!

## 문제 해결

### "D1 데이터베이스가 설정되지 않았습니다" 오류
- Variable name이 정확히 `DB`인지 확인 (대소문자 구분)
- 재배포를 했는지 확인
- 브라우저 캐시 삭제 후 다시 시도

### 이미지가 업로드되지만 표시되지 않음
- D1 데이터베이스에 `images` 테이블이 있는지 확인:
  ```bash
  npx wrangler d1 execute ocevave-production --remote --command="SELECT * FROM images LIMIT 1"
  ```

### 여전히 작동하지 않음
콘솔 오류 확인:
1. 브라우저에서 F12 (개발자 도구)
2. Console 탭에서 오류 메시지 확인
3. Network 탭에서 실패한 요청 확인

## 데이터베이스 정보

**Database ID**: d3e2fba5-2acd-4a78-a125-d4cf5ee81079
**Database Name**: ocevave-production
**Region**: ENAM
**Size**: 25.5 MB
**Tables**: 12

## 참고

- D1 바인딩은 환경별로 설정됩니다 (Production, Preview)
- Production 환경에만 설정하면 됩니다
- 설정 후 모든 배포에 자동으로 적용됩니다
