import { NextRequest, NextResponse } from "next/server";

function isInvalidApiKeyError(error: Error): boolean {
  return error.message.includes("Invalid API key") || error.message.includes("DOUBLE_CHECK") || error.message.includes("Invalid JWT");
}
import { updateMemberStatus } from "@/lib/checkin-store";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const body = await request.json();
    const params = await context.params;
    const meetingId = params.id;

    const memberId = typeof body?.memberId === "string" ? body.memberId : "";
    const status = typeof body?.status === "string" ? body.status : "";

    if (!meetingId || !memberId || !status) {
      return NextResponse.json(
        { message: "memberId와 status가 필요합니다." },
        { status: 400 },
      );
    }

    const updated = await updateMemberStatus(meetingId, {
      memberId,
      status,
    });

    return NextResponse.json(updated);
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

    if (error instanceof Error && error.message.startsWith("NOT_FOUND_MEETING:")) {
      return NextResponse.json(
        { message: "해당 모임을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message.startsWith("NOT_FOUND_MEMBER:")) {
      return NextResponse.json(
        { message: "해당 참석자를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "INVALID_STATUS") {
      return NextResponse.json(
        { message: "유효하지 않은 상태 값입니다." },
        { status: 400 },
      );
    }

    console.error("PATCH /api/meetings/[id] error", error);

    return NextResponse.json(
      { message: "상태 변경에 실패했습니다." },
      { status: 500 },
    );
  }
}
