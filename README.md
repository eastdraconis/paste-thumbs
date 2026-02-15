# paste-thumbs

`paste-thumbs` (여기여기 붙어라) 모임 체크인 MVP.

- 스택: **Next.js + React + Tailwind CSS + Base UI**
- 목표: 모임 링크 기반으로 참석/불참을 빠르게 모아보기

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) (포트 충돌 시 자동 변경)을 열기.

## 핵심 기능

- 모임 생성: 제목 / 일시 / 장소 + 참석자 이름 목록 입력
- 참석 상태 투표: 참석 / 불참 / 보류
- 모임별 집계: 참석/불참/보류 인원 카운트
- 한눈에 보기: 전체 모임 중 확정 참석 모임 개수

## 서버 저장소(백엔드) 동작

이 프로젝트는 클라이언트 상태만 쓰지 않고, 서버 API를 통해 데이터를 저장합니다.

- `GET /api/meetings` : 모임 목록 조회
- `POST /api/meetings` : 새 모임 생성
- `PATCH /api/meetings/:meetingId` : 특정 참석자의 상태 변경

### 데이터 저장 위치

`data/meetings.json` 파일에 모임 데이터를 저장합니다.

운영 환경에 따라 파일 기반 저장은 성능/안정성 한계가 있을 수 있으니,
실서비스는 PostgreSQL 같은 DB로 교체 권장합니다.

## 향후 확장

- 공유 링크/토큰 기반 초대 화면
- 익명 참석자 체크인(로그인 없이)
- 알림(텔레그램/이메일) 연동
- 모임 일정 캘린더 연동
