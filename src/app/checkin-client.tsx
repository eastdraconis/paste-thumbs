"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Attendance, Meeting } from "@/lib/checkin-types";

type ViewMode = "personal" | "shared";

type CheckinClientProps = {
  mode?: ViewMode;
  ownerToken?: string;
};

const statusList: Attendance[] = ["참석", "불참", "보류"];

const STATUS_CHIP: Record<Attendance, string> = {
  참석: "bg-emerald-100 text-emerald-700 border-emerald-200",
  불참: "bg-rose-100 text-rose-700 border-rose-200",
  보류: "bg-amber-100 text-amber-700 border-amber-200",
};

function attendanceStats(members: Meeting["members"]) {
  return members.reduce<Record<Attendance, number>>(
    (acc, member) => {
      acc[member.status] += 1;
      return acc;
    },
    { 참석: 0, 불참: 0, 보류: 0 },
  );
}

function buildApiUrl(path: string, ownerToken?: string) {
  return ownerToken ? `${path}?ownerToken=${encodeURIComponent(ownerToken)}` : path;
}

export default function CheckinClient({ mode = "personal", ownerToken = "" }: CheckinClientProps) {
  const { data: session, status: sessionStatus } = useSession();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [hasGoogleProvider, setHasGoogleProvider] = useState(false);

  const isSharedMode = mode === "shared";
  const isPersonalMode = mode === "personal";
  const canEdit = isSharedMode || sessionStatus === "authenticated";
  const shareToken = session?.user?.shareToken;

  const allAttending = useMemo(
    () => meetings.filter((meeting) => meeting.members.every((m) => m.status === "참석")),
    [meetings],
  );

  const getShareUrl = () => {
    if (!shareToken || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/share/${shareToken}`;
  };

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await fetch("/api/auth/providers");
        const providers = (await response.json()) as Record<string, unknown>;
        setHasGoogleProvider(Boolean(providers.google));
      } catch {
        setHasGoogleProvider(false);
      }
    };

    const loadMeetings = async () => {
      if (isPersonalMode && sessionStatus === "unauthenticated") {
        setMeetings([]);
        return;
      }

      if (isPersonalMode && sessionStatus === "loading") {
        return;
      }

      setError("");

      try {
        const response = await fetch(buildApiUrl("/api/meetings", ownerToken));
        const result = (await response.json()) as Meeting[];

        if (!response.ok) {
          throw new Error("모임 목록을 불러오지 못했습니다.");
        }

        setMeetings(result);
      } catch {
        setError("모임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    };

    loadProviders();
    loadMeetings();
  }, [isPersonalMode, sessionStatus, ownerToken]);

  const submitMeeting = async () => {
    const parsedMembers = memberInput
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);

    if (!title.trim() || !date.trim() || parsedMembers.length === 0) {
      setError("제목, 일시, 참석자 입력은 필수입니다.");
      return;
    }

    setIsBusy(true);
    setError("");

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          date: date.trim(),
          place: place.trim(),
          members: parsedMembers,
        }),
      });

      const payload = (await response.json()) as Meeting;

      if (!response.ok) {
        throw new Error((payload as { message?: string })?.message ?? "모임 생성에 실패했습니다.");
      }

      setMeetings((prev) => [payload, ...prev]);
      setTitle("");
      setDate("");
      setPlace("");
      setMemberInput("");
      setToast("새 체크인이 생성되었습니다. 위의 공유 링크를 눌러 참가 링크를 전달하세요.");
      setTimeout(() => {
        setToast("");
      }, 1800);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("모임 생성에 실패했습니다.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const updateStatus = async (meetingId: string, memberId: string, status: Attendance) => {
    if (!canEdit) {
      return;
    }

    setError("");

    try {
      const response = await fetch(buildApiUrl(`/api/meetings/${meetingId}`, ownerToken), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberId, status }),
      });

      const payload = (await response.json()) as Meeting;

      if (!response.ok) {
        throw new Error((payload as { message?: string })?.message ?? "상태 변경 실패");
      }

      setMeetings((prev) =>
        prev.map((meeting) =>
          meeting.id !== meetingId
            ? meeting
            : {
                ...meeting,
                members: meeting.members.map((member) =>
                  member.id === memberId ? { ...member, status } : member,
                ),
              },
        ),
      );
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("상태 변경에 실패했습니다.");
      }
    }
  };

  const copyShareLink = async () => {
    const link = getShareUrl();

    if (!link) {
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      setToast("공유 링크가 복사되었어요.");
      setTimeout(() => {
        setToast("");
      }, 1800);
    } catch {
      setToast("복사를 실패했어요. 주소창에서 직접 복사해 주세요.");
      setTimeout(() => {
        setToast("");
      }, 1800);
    }
  };

  const copyMeetingShareLink = async (meetingTitle: string) => {
    const link = getShareUrl();

    if (!link) {
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      setToast(`"${meetingTitle}" 체크인 링크가 복사되었어요.`);
      setTimeout(() => {
        setToast("");
      }, 1800);
    } catch {
      setToast("복사를 실패했어요. 주소창에서 직접 복사해 주세요.");
      setTimeout(() => {
        setToast("");
      }, 1800);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100";


  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-indigo-50 p-6 shadow-sm sm:p-8">
          <div className="absolute right-[-2rem] top-[-2rem] h-40 w-40 rounded-full bg-indigo-300/30 blur-2xl" />
          <div className="absolute bottom-[-2rem] left-[-1rem] h-48 w-48 rounded-full bg-emerald-300/25 blur-2xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">paste-thumbs</p>
              <h1 className="mt-3 text-3xl font-black text-slate-900">모임 체크인</h1>
              <p className="mt-2 text-sm text-slate-600">공유 링크로도 빠르게 참석 상태를 모을 수 있는 체크인 보드입니다.</p>
            </div>

            {isPersonalMode ? (
              <div className="flex flex-wrap items-center gap-2">
                {sessionStatus === "loading" ? (
                  <span className="rounded-full bg-white px-3 py-1 text-sm text-slate-500">로그인 상태 확인중...</span>
                ) : sessionStatus === "authenticated" ? (
                  <>
                    <div className="rounded-full bg-white px-3 py-1 text-sm text-slate-700">{session.user?.email || "로그인됨"}</div>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      로그아웃
                    </button>
                    {shareToken ? (
                      <button
                        type="button"
                        onClick={copyShareLink}
                        className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white transition hover:bg-slate-700"
                      >
                        공유 링크 복사
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-full bg-white px-3 py-2 text-xs text-slate-700">
                    {hasGoogleProvider ? (
                      <div className="flex items-center gap-2">
                        <Link
                          href="/auth/login"
                          className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
                        >
                          로그인
                        </Link>
                        <Link
                          href="/auth/signup"
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-semibold"
                        >
                          회원가입(구글)
                        </Link>
                      </div>
                    ) : (
                      <span className="text-amber-700">OAuth 미설정: /api/auth/providers 확인 필요</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-full bg-white px-3 py-2 text-sm text-slate-700">공유 링크 전용 보기</p>
            )}
          </div>

          {toast ? <p className="relative mt-4 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-800">{toast}</p> : null}
        </section>

        {isPersonalMode && sessionStatus === "authenticated" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">새 체크인 만들기</h2>
            <p className="mt-1 text-sm text-slate-500">제목, 일시, 참석자만 입력하면 즉시 공유 링크가 생성됩니다.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
                placeholder="모임 제목"
                className={inputClass}
              />
              <input
                value={date}
                onChange={(event) => setDate(event.currentTarget.value)}
                placeholder="일시 (예: 2월 20일 오후 7시)"
                className={inputClass}
              />
            </div>
            <div className="mt-3">
              <input
                value={place}
                onChange={(event) => setPlace(event.currentTarget.value)}
                placeholder="장소 (선택)"
                className={inputClass}
              />
            </div>
            <div className="mt-3">
              <textarea
                value={memberInput}
                onChange={(event) => setMemberInput(event.currentTarget.value)}
                placeholder="참석자 이름을 줄바꿈으로 입력하세요\n예:\n홍길동\n김영희"
                rows={4}
                className={`${inputClass} resize-none`}
              />
            </div>

            <button
              type="button"
              onClick={submitMeeting}
              disabled={sessionStatus !== "authenticated" || !title.trim() || !date.trim() || !memberInput.trim() || isBusy}
              className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {isBusy ? "저장 중..." : "체크인 만들기"}
            </button>
          </section>
        ) : null}

        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        <section className="grid gap-4">
          {meetings.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">
                {isPersonalMode
                  ? "아직 만든 체크인이 없어요. 위 영역에서 모임을 등록해보세요."
                  : "해당 공유 링크에 모임이 없습니다."}
              </p>
            </div>
          ) : (
            meetings.map((meeting) => {
              const stats = attendanceStats(meeting.members);

              return (
                <div key={meeting.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="rounded-full bg-slate-100 px-2 py-1">{meeting.date}</span>
                    {meeting.place ? <span className="rounded-full bg-slate-100 px-2 py-1">{meeting.place}</span> : null}
                    <span className="rounded-full bg-slate-100 px-2 py-1">총 {meeting.members.length}명</span>
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-slate-900">{meeting.title}</h3>
                  {isPersonalMode && shareToken ? (
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <p className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">공유 링크: /share/{shareToken}</p>
                      <button
                        type="button"
                        onClick={() => copyMeetingShareLink(meeting.title)}
                        className="rounded-full bg-emerald-600 px-3 py-1 font-medium text-white transition hover:bg-emerald-700"
                      >
                        링크 복사
                      </button>
                    </div>
                  ) : null}

                  <div className="mb-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-emerald-300 px-2 py-1 font-medium text-emerald-700">참석 {stats.참석}명</span>
                    <span className="rounded-full border border-rose-300 px-2 py-1 font-medium text-rose-700">불참 {stats.불참}명</span>
                    <span className="rounded-full border border-amber-300 px-2 py-1 font-medium text-amber-700">보류 {stats.보류}명</span>
                  </div>

                  <div className="space-y-2.5">
                    {meeting.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <p className="font-medium text-slate-800">{member.name}</p>
                        <div className="flex flex-wrap gap-2">
                          {statusList.map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => updateStatus(meeting.id, member.id, status)}
                              className={`rounded-full border px-3 py-1 text-sm transition ${
                                member.status === status
                                  ? "bg-slate-900 text-white border-slate-900"
                                  : "text-slate-600 border-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                        <span className={`ml-auto rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_CHIP[member.status]}`}>
                          현재: {member.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">한눈에 보는 상태</h2>
          <p className="mt-2 text-sm text-slate-500">
            전체 {meetings.length}개 체크인 중 <strong>{allAttending.length}</strong>개가 모두 참석으로 확정됐습니다.
          </p>
          {shareToken ? (
            <div className="mt-2 text-xs text-slate-500">개인 공유 링크: <span className="font-mono">/share/{shareToken}</span></div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
