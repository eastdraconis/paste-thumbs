"use client";

import { memo } from "react";
import { Attendance, Meeting } from "@/lib/checkin-types";

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

function formatMeetingDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type MeetingCardProps = {
  meeting: Meeting;
  canEdit: boolean;
  onCopyShareLink: (shareToken: string, title: string) => void;
  onUpdateStatus: (meetingId: string, memberId: string, status: Attendance) => void;
};

function MeetingCardBase({
  meeting,
  canEdit,
  onCopyShareLink,
  onUpdateStatus,
}: MeetingCardProps) {
  const stats = attendanceStats(meeting.members);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="rounded-full bg-slate-100 px-2 py-1">{formatMeetingDate(meeting.date)}</span>
        {meeting.place ? <span className="rounded-full bg-slate-100 px-2 py-1">{meeting.place}</span> : null}
        <span className="rounded-full bg-slate-100 px-2 py-1">총 {meeting.members.length}명</span>
      </div>

      <h3 className="mb-2 text-lg font-semibold text-slate-900">{meeting.title}</h3>
      {meeting.shareToken ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onCopyShareLink(meeting.shareToken, meeting.title)}
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
                  disabled={!canEdit}
                  onClick={() => onUpdateStatus(meeting.id, member.id, status)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    member.status === status
                      ? "bg-slate-900 text-white border-slate-900"
                      : "text-slate-600 border-slate-300 hover:bg-slate-100"
                  } ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
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
}

const MeetingCard = memo(MeetingCardBase);

export default MeetingCard;
