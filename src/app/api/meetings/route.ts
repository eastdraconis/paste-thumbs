import { NextRequest, NextResponse } from "next/server";
import { createMeeting, getMeetings } from "@/lib/checkin-store";
import { NewMeetingPayload } from "@/lib/checkin-types";

function isInvalidApiKeyError(error: Error): boolean {
  return error.message.includes("Invalid API key") || error.message.includes("DOUBLE_CHECK") || error.message.includes("Invalid JWT");
}

export async function GET() {
  try {
    const meetings = await getMeetings();

    return NextResponse.json(meetings);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "SUPABASE_MISCONFIGURED") {
      return NextResponse.json(
        {
          message: "Supabase 환경 변수가 설정되지 않았습니다. SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 확인하세요.",
        },
        { status: 500 },
      );
    }

    if (error instanceof Error && isInvalidApiKeyError(error)) {
      return NextResponse.json(
        {
          message: "Supabase API 키가 유효하지 않습니다. SUPABASE_SERVICE_ROLE_KEY를 다시 등록해 주세요.",
        },
        { status: 500 },
      );
    }

    console.error("GET /api/meetings error", error);

    return NextResponse.json(
      { message: "모임 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
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
      return NextResponse.json(
        { message: "필수 항목(제목/일시/참석자)이 부족합니다." },
        { status: 400 },
      );
    }

    const meeting = await createMeeting({
      title,
      date,
      place,
      members,
    });

    return NextResponse.json(meeting, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "SUPABASE_MISCONFIGURED") {
      return NextResponse.json(
        {
          message: "Supabase 환경 변수가 설정되지 않았습니다. SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 확인하세요.",
        },
        { status: 500 },
      );
    }

    if (error instanceof Error && isInvalidApiKeyError(error)) {
      return NextResponse.json(
        {
          message: "Supabase API 키가 유효하지 않습니다. SUPABASE_SERVICE_ROLE_KEY를 다시 등록해 주세요.",
        },
        { status: 500 },
      );
    }

    console.error("POST /api/meetings error", error);

    return NextResponse.json(
      { message: "모임 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
