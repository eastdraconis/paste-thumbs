"use client";

import { BaseProvider, LightTheme } from "baseui";
import { Client as Styletron } from "styletron-engine-atomic";
import { Provider as StyletronProvider } from "styletron-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "baseui/button";
import { Input } from "baseui/input";
import { Textarea } from "baseui/textarea";
import { Card } from "baseui/card";
import { Attendance, Meeting } from "@/lib/checkin-types";

const statusList: Attendance[] = ["참석", "불참", "보류"];

const STATUS_CHIP: Record<Attendance, string> = {
  참석: "bg-emerald-100 text-emerald-700 border-emerald-200",
  불참: "bg-rose-100 text-rose-700 border-rose-200",
  보류: "bg-amber-100 text-amber-700 border-amber-200",
};

const engine = new Styletron();

function attendanceStats(members: Meeting["members"]) {
  return members.reduce<Record<Attendance, number>>(
    (acc, member) => {
      acc[member.status] += 1;
      return acc;
    },
    { 참석: 0, 불참: 0, 보류: 0 },
  );
}

export default function CheckinClient() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const allAttending = useMemo(
    () => meetings.filter((meeting) => meeting.members.every((m) => m.status === "참석")),
    [meetings],
  );

  useEffect(() => {
    const loadMeetings = async () => {
      try {
        const response = await fetch("/api/meetings");
        const result = (await response.json()) as Meeting[];

        if (!response.ok) {
          throw new Error("모임 목록을 불러오지 못했습니다.");
        }

        setMeetings(result);
      } catch {
        setError("모임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    };

    loadMeetings();
  }, []);

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

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message ?? "모임 생성에 실패했습니다.");
      }

      setMeetings((prev) => [payload as Meeting, ...prev]);
      setTitle("");
      setDate("");
      setPlace("");
      setMemberInput("");
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
    setError("");

    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ memberId, status }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message ?? "상태 변경 실패");
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

  return (
    <StyletronProvider value={engine}>
      <BaseProvider theme={LightTheme}>
        <main className="min-h-screen bg-slate-50 p-6 text-slate-900 sm:p-10">
          <div className="mx-auto w-full max-w-5xl space-y-8">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
              <h1 className="text-3xl font-bold text-slate-900">여기여기 붙어라(paste-thumbs)</h1>
              <p className="mt-2 text-sm text-slate-500">모임 체크인 MVP · 빠르게 참석 여부를 수집하고 정리해줘요.</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  placeholder="모임 제목"
                />
                <Input
                  value={date}
                  onChange={(event) => setDate(event.currentTarget.value)}
                  placeholder="일시 (예: 2월 20일 오후 7시)"
                />
              </div>
              <div className="mt-3">
                <Input
                  value={place}
                  onChange={(event) => setPlace(event.currentTarget.value)}
                  placeholder="장소 (선택)"
                />
              </div>
              <div className="mt-3">
                <Textarea
                  value={memberInput}
                  onChange={(event) => setMemberInput(event.currentTarget.value)}
                  placeholder="참석자 이름을 줄바꿈으로 입력하세요\n예:\n홍길동\n김영희"
                  rows={4}
                />
              </div>

              <Button
                onClick={submitMeeting}
                disabled={!title.trim() || !date.trim() || !memberInput.trim() || isBusy}
                className="mt-4"
              >
                {isBusy ? "저장 중..." : "체크인 만들기"}
              </Button>

              {error ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
            </section>

            <section className="grid gap-4">
              {meetings.length === 0 ? (
                <Card>
                  <p className="text-sm text-slate-500">아직 만든 체크인이 없어요. 위 폼에서 모임을 등록해보세요.</p>
                </Card>
              ) : (
                meetings.map((meeting) => {
                  const stats = attendanceStats(meeting.members);

                  return (
                    <Card key={meeting.id} title={meeting.title}>
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 py-1">{meeting.date}</span>
                        {meeting.place ? <span className="rounded-full bg-slate-100 px-2 py-1">{meeting.place}</span> : null}
                        <span className="rounded-full bg-slate-100 px-2 py-1">참석률 확인</span>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border px-2 py-1 font-medium text-emerald-700">참석 {stats.참석}명</span>
                        <span className="rounded-full border px-2 py-1 font-medium text-rose-700">불참 {stats.불참}명</span>
                        <span className="rounded-full border px-2 py-1 font-medium text-amber-700">보류 {stats.보류}명</span>
                      </div>

                      <div className="space-y-3">
                        {meeting.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                          >
                            <p className="font-medium text-slate-800">{member.name}</p>
                            <div className="flex flex-wrap gap-2">
                              {statusList.map((status) => (
                                <Button
                                  key={status}
                                  kind={member.status === status ? "primary" : "secondary"}
                                  onClick={() => updateStatus(meeting.id, member.id, status)}
                                  overrides={{
                                    Root: {
                                      style: {
                                        borderRadius: "9999px",
                                      },
                                    },
                                  }}
                                >
                                  {status}
                                </Button>
                              ))}
                            </div>
                            <span
                              className={`ml-auto rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_CHIP[member.status]}`}
                            >
                              현재: {member.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })
              )}
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h2 className="text-xl font-semibold text-slate-900">한눈에 보는 상태</h2>
              <p className="mt-2 text-sm text-slate-500">
                전체 {meetings.length}개 체크인 중 <strong>{allAttending.length}</strong>개가 모두 확정 참석입니다.
              </p>
            </section>
          </div>
        </main>
      </BaseProvider>
    </StyletronProvider>
  );
}
