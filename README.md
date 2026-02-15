# paste-thumbs

`paste-thumbs` (여기여기 붙어라) 모임 체크인 MVP.

- 스택: **Next.js + React + Tailwind CSS + Base UI + Supabase(PostgreSQL)**
- 목표: 모임 링크 기반으로 참석/불참을 빠르게 모아보기

## 시작하기

```bash
npm install
cp .env.example .env.local  # Supabase 값 입력
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) (포트 충돌 시 자동 변경)을 열기.

## 핵심 기능

- 모임 생성: 제목 / 일시 / 장소 + 참석자 이름 목록 입력
- 참석 상태 투표: 참석 / 불참 / 보류
- 모임별 집계: 참석/불참/보류 인원 카운트
- 한눈에 보기: 전체 모임 중 확정 참석 모임 개수

## 서버 저장소(백엔드) 동작

이 프로젝트는 서버 API를 통해 Supabase(PostgreSQL)에 저장합니다.

- `GET /api/meetings` : 모임 목록 조회
- `POST /api/meetings` : 새 모임 생성
- `PATCH /api/meetings/:meetingId` : 특정 참석자의 상태 변경

## DB 스키마

`supabase/migrations/20260215000000_init.sql`에 포함되어 있습니다.

## 환경 변수

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (서버 라우트에서 사용)

## 운영 주의

- 운영에서는 서비스 롤 키를 안전하게 보관하세요.
- 향후 공개 초대 링크, 사용자 인증, 알림 연동을 위해 RLS 정책을 추가해 보안을 강화할 수 있습니다.
