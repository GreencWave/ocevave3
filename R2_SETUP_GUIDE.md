# R2 Storage 설정 가이드

## R2란?
Cloudflare R2는 AWS S3와 호환되는 객체 스토리지 서비스입니다. 이미지, 동영상 등 대용량 파일을 저장하기에 적합합니다.

## R2 활성화 단계

### 1. Cloudflare Dashboard 접속
1. https://dash.cloudflare.com 방문
2. 로그인

### 2. R2 활성화
1. 왼쪽 메뉴에서 **R2** 클릭
2. **Enable R2** 버튼 클릭
3. 결제 정보 입력 (필요시)
   - 첫 10GB/월은 무료
   - 초과 시: $0.015/GB/월

### 3. R2 Bucket 생성
활성화 후 터미널에서 실행:
```bash
cd /home/user/webapp
npx wrangler r2 bucket create ocevave-images
```

### 4. Cloudflare Pages에 R2 바인딩 추가
1. Dashboard > Pages > ocevave
2. Settings > Functions
3. **R2 Bucket Bindings** 섹션에서 **Add binding** 클릭
4. 입력:
   - Variable name: `R2`
   - R2 bucket: `ocevave-images`
5. **Save** 클릭
6. **Retry deployment** 클릭하여 재배포

## R2 가격 정책
- **Storage**: 첫 10GB 무료, 이후 $0.015/GB/월
- **Class A Operations** (write): 첫 100만 요청 무료, 이후 $4.50/백만 요청
- **Class B Operations** (read): 첫 1000만 요청 무료, 이후 $0.36/백만 요청
- **Egress (외부 전송)**: 무료 (AWS S3는 유료)

## 현재 상태 확인
```bash
# R2 버킷 목록 확인
npx wrangler r2 bucket list

# R2 상태 확인
npx wrangler r2 bucket info ocevave-images
```

## 문제 해결
- **Error 10042**: R2가 활성화되지 않음 → Dashboard에서 Enable R2 클릭
- **Binding 오류**: Pages 설정에서 R2 binding 추가 필요
- **권한 오류**: API 토큰에 R2 Edit 권한 확인

## 참고 링크
- R2 문서: https://developers.cloudflare.com/r2/
- R2 가격: https://developers.cloudflare.com/r2/pricing/
