"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Attendance, Meeting } from "@/lib/checkin-types";

type ViewMode = "personal" | "shared";

type CheckinClientProps = {
  mode?: ViewMode;
  ownerToken?: string;
};

type ParsedMembers = {
  names: string[];
  duplicates: string[];
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

function buildApiUrl(path: string, token?: string, isSharedMode = false) {
  if (!token) {
    return path;
  }

  const queryKey = isSharedMode ? "meetingToken" : "ownerToken";
  return `${path}?${queryKey}=${encodeURIComponent(token)}`;
}

function formatShareUrl(shareToken: string, origin: string) {
  return `${origin}/share/${shareToken}`;
}

function parseMemberInput(value: string): ParsedMembers {
  const raw = value
    .split(/\r?\n|,/)
    .map((name) => name.trim())
    .filter(Boolean);

  const duplicates = new Set<string>();
  const seen = new Set<string>();
  const names: string[] = [];

  for (const member of raw) {
    if (seen.has(member)) {
      duplicates.add(member);
      continue;
    }

    seen.add(member);
    names.push(member);
  }

  return { names, duplicates: [...duplicates] };
}

export default function CheckinClient({ mode = "personal", ownerToken = "" }: CheckinClientProps) {
  const { data: session, status: sessionStatus } = useSession();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [memberItems, setMemberItems] = useState<string[]>([]);
  const [memberInputMessage, setMemberInputMessage] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [hasGoogleProvider, setHasGoogleProvider] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const isSharedMode = mode === "shared";
  const isPersonalMode = mode === "personal";
  const canEdit = isSharedMode || sessionStatus === "authenticated";

  const hasRequiredInputs = title.trim().length > 0 && date.trim().length > 0 && memberItems.length > 0;
  const memberCount = memberItems.length;

  const allAttending = useMemo(
    () => meetings.filter((meeting) => meeting.members.every((m) => m.status === "참석")),
    [meetings],
  );

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
        const response = await fetch(buildApiUrl("/api/meetings", ownerToken, isSharedMode));
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
  }, [isPersonalMode, sessionStatus, ownerToken, isSharedMode]);

  const getMemberInputMessages = () => {
    if (submitAttempted && memberCount === 0) {
      return "최소 1명 이상의 참석자를 추가해 주세요.";
    }

    return memberInputMessage || `${memberCount}명 입력됨`;
  };

  const addMembers = (rawValue: string) => {
    const parsed = parseMemberInput(rawValue);

    if (parsed.names.length === 0) {
      setMemberInput("");
      setMemberInputMessage("이름이 비어 있어요.");
      return;
    }

    const existingSet = new Set(memberItems);
    const newMembers = parsed.names.filter((name) => !existingSet.has(name));
    const duplicateCount = parsed.names.length - newMembers.length;

    if (duplicateCount > 0) {
      setMemberInputMessage(`${duplicateCount}명 중복은 제외되고 추가됐어요.`);
    } else {
      setMemberInputMessage(`"${newMembers.length}명"이(가) 추가됐어요.`);
    }

    if (newMembers.length === 0) {
      setMemberInput("");
      return;
    }

    setMemberItems((prev) => [...prev, ...newMembers]);
    setMemberInput("");

    window.setTimeout(() => {
      setMemberInputMessage((current) => (current.startsWith("중복") ? "" : current));
    }, 1500);
  };

  const removeMember = (index: number) => {
    setMemberItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submitMeeting = async () => {
    setSubmitAttempted(true);

    if (!hasRequiredInputs) {
      setError("필수 항목을 모두 입력해 주세요.");
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
          members: memberItems,
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
      setMemberItems([]);
      setMemberInputMessage("");
      setSubmitAttempted(false);
      setToast(
        "체크인 링크가 생성되었습니다. 새 카드의 '체크인 링크 복사'로 공유하세요.",
      );
      setTimeout(() => {
        setToast("");
      }, 2200);
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMeeting();
  };

  const handleMemberKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      addMembers(memberInput);
    }
  };

  const resetDraft = () => {
    setTitle("");
    setDate("");
    setPlace("");
    setMemberInput("");
    setMemberItems([]);
    setMemberInputMessage("");
    setSubmitAttempted(false);
    setError("");
  };

  const isFormDirty =
    title.trim().length > 0 ||
    date.trim().length > 0 ||
    place.trim().length > 0 ||
    memberInput.trim().length > 0 ||
    memberItems.length > 0;

  const updateStatus = async (meetingId: string, memberId: string, status: Attendance) => {
    if (!canEdit) {
      return;
    }

    setError("");

    try {
      const response = await fetch(buildApiUrl(`/api/meetings/${meetingId}`, ownerToken, isSharedMode), {
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

  const copyShareLink = async (shareToken: string, label: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const link = formatShareUrl(shareToken, window.location.origin);

    try {
      await navigator.clipboard.writeText(link);
      setToast(`"${label}" 체크인 링크가 복사되었어요.`);
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

  const getInputClass = (isInvalid = false) =>
    `${inputClass} ${
      isInvalid ? "border-rose-300 bg-rose-50/50 focus:border-rose-400 focus:ring-rose-100" : ""
    }`;

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
                    <div className="rounded-full bg-white px-3 py-1 text-sm text-slate-700">
                      {session.user?.email || "로그인됨"}
                    </div>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      로그아웃
                    </button>
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
            <p className="mt-1 text-sm text-slate-500">입력한 뒤 바로 링크를 전달해 참석 상태를 모아보세요.</p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    모임 제목 <span className="text-rose-500">*</span>
                  </span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.currentTarget.value)}
                    placeholder="예: 팀 회식"
                    className={getInputClass(submitAttempted && !title.trim())}
                  />
                  {submitAttempted && !title.trim() ? (
                    <p className="text-xs text-rose-600">모임 제목을 입력해 주세요.</p>
                  ) : (
                    <p className="text-xs text-slate-500">누가 어디서 모였는지 한 줄로 적어주세요.</p>
                  )}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    일시 <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="datetime-local"
                    value={date}
                    onChange={(event) => setDate(event.currentTarget.value)}
                    className={getInputClass(submitAttempted && !date.trim())}
                  />
                  {submitAttempted && !date.trim() ? (
                    <p className="text-xs text-rose-600">일시를 입력해 주세요.</p>
                  ) : (
                    <p className="text-xs text-slate-500">날짜와 시간을 한 번에 선택할 수 있습니다.</p>
                  )}
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">장소</span>
                <input
                  value={place}
                  onChange={(event) => setPlace(event.currentTarget.value)}
                  placeholder="예: 서울 강남 OO카페"
                  className={inputClass}
                />
                <p className="text-xs text-slate-500">선택 입력입니다. 비워두면 생략됩니다.</p>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  참석자 <span className="text-rose-500">*</span>
                </span>

                {memberItems.length > 0 ? (
                  <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                    {memberItems.map((member, index) => (
                      <span
                        key={`${member}-${index}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-sm"
                      >
                        <span>{member}</span>
                        <button
                          type="button"
                          onClick={() => removeMember(index)}
                          className="rounded-full px-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`${member} 삭제`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                <input
                  value={memberInput}
                  onChange={(event) => setMemberInput(event.currentTarget.value)}
                  onKeyDown={handleMemberKeyDown}
                  placeholder="참석자 이름을 입력하고 엔터로 추가"
                  className={`${getInputClass(submitAttempted && memberItems.length === 0)} resize-none`}
                />
                <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-slate-500">
                  <p>{getMemberInputMessages()}</p>
                  <p className="whitespace-nowrap">(엔터로 추가)</p>
                </div>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={sessionStatus !== "authenticated" || !hasRequiredInputs || isBusy}
                  className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? "저장 중..." : "체크인 만들기"}
                </button>

                <button
                  type="button"
                  onClick={resetDraft}
                  disabled={!isFormDirty || isBusy}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  입력 초기화
                </button>
              </div>
            </form>
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
                  {meeting.shareToken ? (
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => copyShareLink(meeting.shareToken, meeting.title)}
                        className="rounded-full bg-emerald-600 px-3 py-1 font-medium text-white transition hover:bg-emerald-700"
                      >
                        체크인 링크 복사
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
        </section>
      </div>
    </main>
  );
}
