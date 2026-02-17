"use client";

import Link from "next/link";
import {
  KeyboardEvent,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signOut, useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import MeetingCard from "./meeting-card";
import { Attendance, Meeting } from "@/lib/checkin-types";
import {
  createMeeting,
  fetchAuthProviders,
  fetchMeetings,
  updateMeetingStatus,
} from "@/lib/checkin-fetcher";
import { checkinQueryKeys } from "@/lib/checkin-queries";
import { ViewMode } from "@/lib/checkin-query-types";

type CheckinClientProps = {
  mode?: ViewMode;
  ownerToken?: string;
};

type ParsedMembers = {
  names: string[];
  duplicates: string[];
};

type CheckinFormValues = z.infer<typeof checkinSchema>;


const MAX_ATTENDEES = 50;


const checkinSchema = z.object({
  title: z.string().trim().min(1, "모임 제목을 입력해 주세요."),
  date: z.string().trim().min(1, "일시를 입력해 주세요."),
  place: z.string().trim().optional(),
  attendees: z
    .array(
      z.object({
        name: z.string().trim().min(1, "참석자 이름을 입력해 주세요."),
      }),
    )
    .min(1, "최소 1명 이상의 참석자를 추가해 주세요."),
});

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

  const [memberInput, setMemberInput] = useState("");
  const [memberInputMessage, setMemberInputMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState("");

  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
    control,
  } = useForm<CheckinFormValues>({
    resolver: zodResolver(checkinSchema),
    defaultValues: {
      title: "",
      date: "",
      place: "",
      attendees: [],
    },
    mode: "onBlur",
  });

  const { fields, append, replace } = useFieldArray({
    control,
    name: "attendees",
  });

  const isSharedMode = mode === "shared";
  const isPersonalMode = mode === "personal";
  const canEdit = isSharedMode || sessionStatus === "authenticated";

  const memberCount = fields.length;

  const meetingsEnabled = isSharedMode || sessionStatus === "authenticated";
  const meetingsQueryKey = checkinQueryKeys.meetings(mode, ownerToken);

  const providersQuery = useQuery({
    queryKey: checkinQueryKeys.authProviders,
    queryFn: fetchAuthProviders,
    staleTime: 5 * 60 * 1000,
  });

  const meetingsQuery = useQuery({
    queryKey: meetingsQueryKey,
    queryFn: () => fetchMeetings({ ownerToken, isSharedMode }),
    enabled: meetingsEnabled,
  });

  const meetings = useMemo(
    () => (meetingsEnabled ? (meetingsQuery.data ?? []) : []),
    [meetingsEnabled, meetingsQuery.data],
  );
  const hasGoogleProvider = Boolean(providersQuery.data?.google);
  const queryErrorMessage = meetingsQuery.error instanceof Error ? meetingsQuery.error.message : "";
  const submitError = actionError || queryErrorMessage;

  const allAttending = useMemo(
    () => meetings.filter((meeting) => meeting.members.every((m) => m.status === "참석")),
    [meetings],
  );

  const addMembers = (rawValue: string) => {
    const parsed = parseMemberInput(rawValue);
    const currentNames = new Set(fields.map((member) => member.name));

    if (parsed.names.length === 0) {
      setMemberInput("");
      setMemberInputMessage("이름이 비어 있어요.");
      return;
    }

    const remainingSlots = MAX_ATTENDEES - fields.length;

    if (remainingSlots <= 0) {
      setMemberInputMessage(`참석자 수는 최대 ${MAX_ATTENDEES}명까지 추가할 수 있어요.`);
      setMemberInput("");
      return;
    }

    const deduped = parsed.names.filter((name) => !currentNames.has(name));
    const duplicateWithCurrent = parsed.names.length - deduped.length;
    const filteredNew = deduped.slice(0, Math.max(0, remainingSlots));

    if (filteredNew.length > 0) {
      append(filteredNew.map((name) => ({ name })));
    }

    const droppedCount = deduped.length - filteredNew.length;

    if (duplicateWithCurrent > 0) {
      setMemberInputMessage(`${duplicateWithCurrent}명은 이미 목록에 있어 제외했어요.`);
      if (droppedCount > 0) {
        setMemberInputMessage(`새로운 입력 중 ${droppedCount}명은 최대 ${MAX_ATTENDEES}명 제한으로 제외했어요.`);
      }
    } else if (droppedCount > 0) {
      setMemberInputMessage(`남은 ${remainingSlots}명까지만 추가돼요.`);
    } else {
      setMemberInputMessage(`"${filteredNew.length}명"이(가) 추가됐어요.`);
    }

    setMemberInput("");
    window.setTimeout(() => {
      setMemberInputMessage("");
    }, 1500);
  };

  const removeMember = (memberId: string) => {
    replace(fields.filter((member) => member.id !== memberId).map((member) => ({ name: member.name })));
  };

  const getMemberInputMessage = () => {
    if (actionError || errors.attendees?.message) {
      return errors.attendees?.message ?? "";
    }

    if (memberCount >= MAX_ATTENDEES) {
      return `최대 ${MAX_ATTENDEES}명 참여 가능`;
    }

    return memberInputMessage || `${memberCount}명 입력됨`;
  };

  const createMeetingMutation = useMutation({
    mutationFn: async (values: CheckinFormValues) =>
      createMeeting({
        title: values.title.trim(),
        date: values.date.trim(),
        place: values.place?.trim() ?? "",
        members: values.attendees.map((member) => member.name),
      }),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: meetingsQueryKey });

      const previousMeetings = queryClient.getQueryData<Meeting[]>(meetingsQueryKey) ?? [];

      const optimisticMeeting: Meeting = {
        id: `temp-${Date.now()}`,
        title: values.title.trim(),
        date: values.date.trim(),
        place: values.place?.trim() ?? "",
        members: values.attendees.map((member, index) => ({
          id: `temp-member-${index}-${Date.now()}`,
          name: member.name,
          status: "보류",
        })),
        createdAt: new Date().toISOString(),
        shareToken: "",
      };

      queryClient.setQueryData<Meeting[]>(meetingsQueryKey, [optimisticMeeting, ...previousMeetings]);

      return { previousMeetings, optimisticId: optimisticMeeting.id };
    },
    onError: (_error, _values, context) => {
      if (context?.previousMeetings) {
        queryClient.setQueryData<Meeting[]>(meetingsQueryKey, context.previousMeetings);
      }
    },
    onSuccess: (created, _values, context) => {
      queryClient.setQueryData<Meeting[]>(meetingsQueryKey, (prev) => {
        const safePrev = prev ?? [];
        const removedOptimistic = context?.optimisticId
          ? safePrev.filter((meeting) => meeting.id !== context.optimisticId)
          : safePrev;
        return [created, ...removedOptimistic];
      });

      reset({ title: "", date: "", place: "", attendees: [] });
      replace([]);
      setMemberInput("");
      setMemberInputMessage("");
      setToast("체크인 링크가 생성되었습니다. 새 카드의 '체크인 링크 복사'로 공유하세요.");
      setTimeout(() => {
        setToast("");
      }, 2200);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: meetingsQueryKey });
    },
  });

  const submitMeeting = useCallback(async (values: CheckinFormValues) => {
    setActionError("");
    try {
      await createMeetingMutation.mutateAsync(values);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setActionError(e.message);
      } else {
        setActionError("모임 생성에 실패했습니다.");
      }
    }
  }, [createMeetingMutation]);

  const handleMemberKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      addMembers(memberInput);
    }
  };

  const resetDraft = () => {
    reset({ title: "", date: "", place: "", attendees: [] });
    replace([]);
    setMemberInput("");
    setMemberInputMessage("");
    setActionError("");
  };

  const [watchTitle, watchDate, watchPlace] = useWatch({
    control,
    name: ["title", "date", "place"],
  });

  const isFormDirty = useMemo(
    () =>
      (watchTitle ?? "").trim().length > 0 ||
      (watchDate ?? "").trim().length > 0 ||
      (watchPlace ?? "").trim().length > 0 ||
      memberInput.trim().length > 0 ||
      memberCount > 0,
    [watchTitle, watchDate, watchPlace, memberInput, memberCount],
  );

  const updateStatusMutation = useMutation({
    mutationFn: async ({ meetingId, memberId, status }: { meetingId: string; memberId: string; status: Attendance }) => {
      await updateMeetingStatus({
        meetingId,
        memberId,
        status,
        ownerToken,
        isSharedMode,
      });

      return { meetingId, memberId, status };
    },
    onMutate: async ({ meetingId, memberId, status }) => {
      await queryClient.cancelQueries({ queryKey: meetingsQueryKey });

      const previousMeetings = queryClient.getQueryData<Meeting[]>(meetingsQueryKey) ?? [];

      queryClient.setQueryData<Meeting[]>(meetingsQueryKey,
        previousMeetings.map((meeting) =>
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

      return { previousMeetings };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousMeetings) {
        queryClient.setQueryData<Meeting[]>(meetingsQueryKey, context.previousMeetings);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: meetingsQueryKey });
    },
  });

  const updateStatus = useCallback(async (meetingId: string, memberId: string, status: Attendance) => {
    if (!canEdit) {
      return;
    }

    setActionError("");

    try {
      await updateStatusMutation.mutateAsync({ meetingId, memberId, status });
    } catch (e: unknown) {
      if (e instanceof Error) {
        setActionError(e.message);
      } else {
        setActionError("상태 변경에 실패했습니다.");
      }
    }
  }, [canEdit, updateStatusMutation]);

  const copyShareLink = useCallback(async (shareToken: string, label: string) => {
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
  }, []);

  const isCreating = isSubmitting || createMeetingMutation.isPending;

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

            <form onSubmit={handleSubmit(submitMeeting)} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    모임 제목 <span className="text-rose-500">*</span>
                  </span>
                  <input
                    {...register("title")}
                    placeholder="예: 팀 회식"
                    className={getInputClass(Boolean(errors.title))}
                  />
                  <p className="text-xs text-rose-600">{errors.title?.message || "누가 어디서 모였는지 한 줄로 적어주세요."}</p>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    일시 <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="datetime-local"
                    {...register("date")}
                    className={getInputClass(Boolean(errors.date))}
                  />
                  <p className="text-xs text-rose-600">{errors.date?.message || "날짜와 시간을 한 번에 선택할 수 있습니다."}</p>
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">장소</span>
                <input
                  {...register("place")}
                  placeholder="예: 서울 강남 OO카페"
                  className={inputClass}
                />
                <p className="text-xs text-slate-500">선택 입력입니다. 비워두면 생략됩니다.</p>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  참석자 <span className="text-rose-500">*</span>
                </span>

                {memberCount > 0 ? (
                  <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                    {fields.map((member) => (
                      <span
                        key={member.id}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-sm"
                      >
                        <span>{member.name}</span>
                        <button
                          type="button"
                          onClick={() => removeMember(member.id)}
                          className="rounded-full px-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`${member.name} 삭제`}
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
                  className={`${getInputClass(Boolean(errors.attendees))} resize-none`}
                />
                <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-slate-500">
                  <p>{getMemberInputMessage()}</p>
                  <p className="whitespace-nowrap">(엔터로 추가)</p>
                </div>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isCreating || !isValid}
                  className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? "저장 중..." : "체크인 만들기"}
                </button>

                <button
                  type="button"
                  onClick={resetDraft}
                  disabled={!isFormDirty || isCreating}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  입력 초기화
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {submitError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{submitError}</p> : null}

        <section className="grid gap-4">
          {meetingsQuery.isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">체크인 목록을 불러오는 중...</p>
            </div>
          ) : meetings.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">
                {isPersonalMode
                  ? "아직 만든 체크인이 없어요. 위 영역에서 모임을 등록해보세요."
                  : "해당 공유 링크에 모임이 없습니다."}
              </p>
            </div>
          ) : (
            meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                canEdit={canEdit}
                onCopyShareLink={copyShareLink}
                onUpdateStatus={updateStatus}
              />
            ))
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
