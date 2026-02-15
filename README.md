# paste-thumbs

`paste-thumbs` (여기여기 붙어라) 모임 체크인 MVP.

- 스택: **Next.js + React + Tailwind CSS + Base UI + Supabase(PostgreSQL)**
- 목표: 모임 링크 기반으로 참석/불참을 빠르게 모아보기

## 시작하기

```bash
npm install
cp .env.example .env.local  # Supabase 값 + OAuth 값 입력
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) (포트 충돌 시 자동 변경)을 열기.

## 핵심 기능

- OAuth 로그인(Google)
- 모임 생성: 제목 / 일시 / 장소 + 참석자 이름 목록 입력
- 참석 상태 투표: 참석 / 불참 / 보류
- 사용자별 모임 관리 + 공유 링크 생성(자신만의 URL)
  - 체크인 생성 후 상단 `공유 링크 복사` 또는 각 체크인 카드의 `링크 복사`로 공유 링크를 바로 전달할 수 있습니다.
  - 각 링크는 개인 공유 링크(`/share/{ownerShareToken}`)이며, 해당 사용자의 체크인 목록에 접근 가능합니다.
- 공유 링크 기반 접속: `/share/{shareToken}`
- 모임별 집계: 참석/불참/보류 인원 카운트
- 한눈에 보기: 전체 모임 중 확정 참석 모임 개수

## 체크인 생성 + 공유 가이드

1. 로그인 후 홈에서 `새 체크인 만들기`로 제목/일시/참석자 입력
2. `체크인 만들기` 클릭
3. 생성 완료 토스트에서 링크 복사 버튼 사용(또는 상단 `공유 링크 복사`)
4. 공유된 링크(`{domain}/share/{ownerShareToken}`)를 참가자에게 전달
5. 링크 접속 후 버튼으로 각 참석자 상태(참석/불참/보류) 갱신

## 서버 저장소(백엔드) 동작

이 프로젝트는 서버 API를 통해 Supabase(PostgreSQL)에 저장합니다.

- `GET /api/meetings` : 내 모임 목록 조회 (로그인 필요) 또는 `ownerToken` 쿼리로 공유 조회
- `POST /api/meetings` : 새 모임 생성 (로그인 필요)
- `PATCH /api/meetings/:meetingId` : 참석자 상태 변경 (모임 소유자 또는 공유 토큰 소유자가 허용)

## DB 스키마

- `meetings`
  - `owner_email`, `owner_share_token` 추가로 사용자별로 분리되어 조회/업데이트됨
- `meeting_members`
  - 모임별 참석자, 참석 상태 저장

## 환경 변수

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (서버 라우트에서 사용)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`

## 운영 주의

- 운영에서는 서비스 롤 키와 OAuth 비밀키를 안전하게 보관하세요.
- OAuth/세션 인증은 로그인 사용자 식별용이며, 공유 URL은 해당 사용자 고유 링크를 노출합니다.
- 노출 가능한 공유 링크라도 민감 데이터는 과도하게 저장하지 않도록 주의하세요.

- Vercel 배포/로컬 DB 업그레이드 후 `supabase/migrations/20260216000000_add_owner_share.sql` 반영이 필요합니다.
