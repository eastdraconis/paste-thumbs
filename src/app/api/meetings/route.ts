import { NextRequest, NextResponse } from "next/server";
import { createMeeting, getMeetings } from "@/lib/checkin-store";
import { NewMeetingPayload } from "@/lib/checkin-types";

export async function GET() {
  try {
    const meetings = await getMeetings();

    return NextResponse.json(meetings);
  } catch {
    return NextResponse.json({ message: "모임 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<NewMeetingPayload>;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const place = typeof body.place === "string" ? body.place.trim() : "";
    const membersInput = Array.isArray(body.members) ? body.members : [];

    const members = membersInput
      .map((name) => (typeof name === "string" ? name.trim() : ""))
      .filter(Boolean);

    if (!title || !date || members.length === 0) {
      return NextResponse.json({ message: "필수 항목(제목/일시/참석자)이 부족합니다." }, { status: 400 });
    }

    const meeting = await createMeeting({ title, date, place, members });

    return NextResponse.json(meeting, { status: 201 });
  } catch {
    return NextResponse.json({ message: "모임 저장에 실패했습니다." }, { status: 500 });
  }
}
