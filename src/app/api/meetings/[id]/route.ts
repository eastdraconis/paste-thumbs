import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getMeetingOwner, updateMemberStatus } from "@/lib/checkin-store";
import { authOptions } from "@/lib/auth";

function isInvalidApiKeyError(error: Error): boolean {
  return error.message.includes("Invalid API key") || error.message.includes("DOUBLE_CHECK") || error.message.includes("Invalid JWT");
}

function isOwnerColumnMissing(errorMessage: string): boolean {
  return errorMessage.includes("owner_email") || errorMessage.includes("owner_share_token") || errorMessage.includes("column");
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const url = new URL(request.url);
    const ownerToken = url.searchParams.get("ownerToken") || "";

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

    const meetingOwner = await getMeetingOwner(meetingId);
    if (!meetingOwner) {
      return NextResponse.json(
        { message: "해당 모임을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (!ownerToken) {
      const session = await getServerSession(authOptions);
      const email = session?.user?.email;

      if (!email || email !== meetingOwner.owner_email) {
        return NextResponse.json(
          {
            message: "해당 모임을 수정할 권한이 없습니다.",
          },
          { status: 403 },
        );
      }
    } else if (!meetingOwner.owner_share_token || ownerToken !== meetingOwner.owner_share_token) {
      return NextResponse.json(
        {
          message: "공유 링크가 유효하지 않습니다.",
        },
        { status: 403 },
      );
    }

    const updated = await updateMemberStatus(meetingId, {
      memberId,
      status,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof Error && isOwnerColumnMissing(error.message)) {
      return NextResponse.json(
        {
          message:
            "DB 스키마 업데이트가 필요합니다. meetings 테이블에 owner_email / owner_share_token 컬럼을 추가해 주세요.",
        },
        { status: 500 },
      );
    }

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
