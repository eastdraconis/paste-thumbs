import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  getMeetings,
  getMeetingsByOwnerToken,
  getMeetingByShareToken,
  createMeeting,
} from "@/lib/checkin-store";
import { ownerShareToken } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { NewMeetingPayload } from "@/lib/checkin-types";

function isInvalidApiKeyError(error: Error): boolean {
  return error.message.includes("Invalid API key") || error.message.includes("DOUBLE_CHECK") || error.message.includes("Invalid JWT");
}

function isOwnerColumnMissing(errorMessage: string): boolean {
  return errorMessage.includes("owner_email") || errorMessage.includes("owner_share_token") || errorMessage.includes("column");
}

function isShareTokenColumnMissing(errorMessage: string): boolean {
  return errorMessage.includes("share_token") || isOwnerColumnMissing(errorMessage);
}

function resolveOwnerToken(email?: string): string {
  if (!email) {
    return "";
  }

  return ownerShareToken(email);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const ownerToken = url.searchParams.get("ownerToken") || "";
    const meetingToken = url.searchParams.get("meetingToken") || "";

    if (meetingToken) {
      const meeting = await getMeetingByShareToken(meetingToken);
      if (meeting) {
        return NextResponse.json([meeting]);
      }

      const legacyMeetings = await getMeetingsByOwnerToken(meetingToken);
      return NextResponse.json(legacyMeetings);
    }

    if (ownerToken) {
      const meetings = await getMeetingsByOwnerToken(ownerToken);
      return NextResponse.json(meetings);
    }

    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json(
        {
          message: "로그인 후 이용 가능합니다.",
        },
        { status: 401 },
      );
    }

    const meetings = await getMeetings(email);

    return NextResponse.json(meetings);
  } catch (error: unknown) {
    if (error instanceof Error && isShareTokenColumnMissing(error.message)) {
      return NextResponse.json(
        {
          message:
            "DB 스키마 업데이트가 필요합니다. meetings 테이블에 share_token / owner_email / owner_share_token 컬럼을 추가해 주세요.",
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

    console.error("GET /api/meetings error", error);

    return NextResponse.json(
      { message: "모임 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json(
        {
          message: "로그인 후 모임을 생성할 수 있습니다.",
        },
        { status: 401 },
      );
    }

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

    const ownerToken = resolveOwnerToken(email);
    const meeting = await createMeeting(
      {
        title,
        date,
        place,
        members,
      },
      email,
      ownerToken,
    );

    return NextResponse.json(meeting, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && isShareTokenColumnMissing(error.message)) {
      return NextResponse.json(
        {
          message:
            "DB 스키마 업데이트가 필요합니다. meetings 테이블에 share_token / owner_email / owner_share_token 컬럼을 추가해 주세요.",
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

    console.error("POST /api/meetings error", error);

    return NextResponse.json(
      { message: "모임 저장에 실패했습니다." },
      { status: 500 },
    );
  }
}
