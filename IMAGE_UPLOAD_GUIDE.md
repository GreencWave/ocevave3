# 이미지 업로드 가이드

## ✅ 이미지 업로드 테스트 완료!

프로덕션 환경에서 이미지 업로드가 **정상 작동**하는 것을 확인했습니다!

### 테스트 결과
- ✅ 로컬 환경: 정상 작동
- ✅ 프로덕션 환경: 정상 작동
- ✅ 이미지 저장: D1 데이터베이스에 base64로 저장
- ✅ 이미지 조회: /api/images/:filename 정상 응답

### 업로드 성공 예시
```bash
# Login
POST https://855bb3dd.ocevave.pages.dev/api/auth/login
Response: {"success":true,"user":{...}}

# Upload
POST https://855bb3dd.ocevave.pages.dev/api/admin/upload-image
Response: {"success":true,"url":"/api/images/1771671435733-twevh8.png"}

# Verify
GET https://855bb3dd.ocevave.pages.dev/api/images/1771671435733-twevh8.png
Response: HTTP 200, Content-Type: image/png
```

## 🎯 올바른 사용 방법

### 1. 최신 배포 URL 사용
**✅ 올바른 URL:**
- https://855bb3dd.ocevave.pages.dev

**❌ 이전 URL (사용하지 마세요):**
- https://4a2929a0.ocevave.pages.dev
- https://104ef7fb.ocevave.pages.dev
- https://a525c4d7.ocevave.pages.dev

### 2. 관리자 로그인
1. https://855bb3dd.ocevave.pages.dev/admin 접속
2. 로그인 정보 입력:
   - Email: `admin@ocevave`
   - Password: `admin123`
3. "관리자 페이지" 표시 확인

### 3. 이미지 업로드 단계

**상품 이미지 업로드:**
1. **상품 관리** 탭 클릭
2. **상품 추가** 또는 기존 상품의 **수정** 버튼 클릭
3. **이미지 파일 선택** 또는 **이미지 URL 입력**
4. 파일 선택 시 미리보기 자동 표시
5. **저장** 버튼 클릭
6. 목록에서 이미지 확인

**이벤트 이미지 업로드:**
1. **이벤트 관리** 탭 클릭
2. **이벤트 추가** 버튼 클릭
3. 제목, 내용, 일정, 장소 입력
4. **이미지 파일 선택**
5. **저장** 버튼 클릭

**활동 이미지 업로드:**
1. **활동 관리** 탭 클릭
2. **활동 추가** 버튼 클릭
3. 제목, 내용, 일정, 장소 입력
4. **이미지 파일 선택**
5. **저장** 버튼 클릭

## ⚠️ 이미지 업로드 제한사항

### 파일 크기
- **최대 크기**: 5MB
- 5MB 이상 파일 업로드 시 오류 발생
- 권장 크기: 500KB ~ 2MB

### 파일 형식
- **지원 형식**: JPG, PNG, GIF, WebP
- **MIME 타입**: image/jpeg, image/png, image/gif, image/webp
- 다른 형식 업로드 시 오류 발생

### 저장 방식
- **로컬/프로덕션**: D1 데이터베이스에 base64 인코딩하여 저장
- **테이블**: `images` (filename, data, content_type)
- **조회 URL**: `/api/images/:filename`

## 🔧 문제 해결

### 문제 1: "이미지 업로드 실패" 오류

**원인:**
- 브라우저 캐시
- 오래된 URL 사용
- 파일 크기 초과
- 관리자 권한 없음

**해결 방법:**
1. **브라우저 캐시 삭제**
   - Chrome: Ctrl+Shift+Delete
   - 캐시된 이미지 및 파일 선택
   - 삭제 클릭

2. **최신 URL 사용 확인**
   - 현재 URL: https://855bb3dd.ocevave.pages.dev
   - 다른 URL이면 위 URL로 접속

3. **파일 크기 확인**
   - 파일 크기 5MB 이하인지 확인
   - 큰 이미지는 압축 후 업로드

4. **관리자 로그인 확인**
   - F12 (개발자 도구) → Console 탭
   - "is_admin": true 확인
   - 없으면 로그아웃 후 재로그인

### 문제 2: 이미지가 업로드되었지만 표시되지 않음

**원인:**
- 브라우저 캐시
- 이미지 URL 오류
- D1 바인딩 미설정

**해결 방법:**
1. 페이지 새로고침 (Ctrl+F5)
2. 브라우저 개발자 도구 확인:
   - F12 → Network 탭
   - 이미지 URL 요청 확인
   - 상태 코드 확인 (200이면 정상)
3. D1 바인딩 확인 (이미 설정됨)

### 문제 3: "D1 데이터베이스가 설정되지 않았습니다" 오류

**해결 완료!**
- ✅ D1 바인딩 이미 설정됨
- ✅ 최신 배포에서 정상 작동
- 이 오류가 나타나면 최신 URL(855bb3dd) 사용 확인

## 📊 업로드 상태 확인

### 브라우저 개발자 도구 사용
1. F12 (개발자 도구 열기)
2. **Console 탭**에서 오류 확인
3. **Network 탭**에서 요청/응답 확인

### 성공적인 업로드 응답
```json
{
  "success": true,
  "url": "/api/images/1771671435733-twevh8.png"
}
```

### 실패한 업로드 응답
```json
{
  "error": "이미지 파일만 업로드 가능합니다."
}
```
또는
```json
{
  "error": "이미지 크기는 5MB 이하여야 합니다."
}
```

## 💡 권장사항

### 이미지 최적화
1. **크기 조정**: 1920x1080 이하 권장
2. **압축**: TinyPNG, ImageOptim 등 사용
3. **포맷**: WebP 또는 최적화된 JPEG 권장

### 업로드 팁
1. 한 번에 하나씩 업로드
2. 파일명에 특수문자 사용 금지
3. 업로드 전 미리보기 확인
4. 저장 후 목록에서 재확인

## 📞 추가 지원

문제가 계속되면:
1. 개발자 도구 Console 오류 메시지 확인
2. Network 탭에서 실패한 요청 확인
3. 오류 메시지와 함께 문의

---

**마지막 업데이트**: 2026-02-21
**테스트 완료**: ✅ 로컬 및 프로덕션 환경
