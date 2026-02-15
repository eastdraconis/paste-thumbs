/* eslint-disable @typescript-eslint/no-explicit-any */
import { Attendance, Meeting, NewMeetingPayload, UpdateMemberStatusPayload } from "./checkin-types";
import { getSupabaseServerClient } from "./supabase";

type MeetingRow = {
  id: string;
  title: string;
  date: string;
  place: string | null;
  created_at: string;
  owner_email: string | null;
  owner_share_token: string | null;
  meeting_members: {
    id: string;
    name: string;
    status: Attendance;
  }[];
};

type MeetingOwner = {
  id: string;
  owner_email: string | null;
  owner_share_token: string | null;
};

function toAttendance(value: string): Attendance | undefined {
  if (value === "참석" || value === "불참" || value === "보류") {
    return value;
  }

  return undefined;
}

function formatDbError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybe = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
    const code = typeof maybe.code === "string" ? maybe.code : "UNKNOWN";
    const message = typeof maybe.message === "string" ? maybe.message : "DB error";
    const details = typeof maybe.details === "string" ? ` - ${maybe.details}` : "";
    const hint = typeof maybe.hint === "string" ? ` (${maybe.hint})` : "";

    return `${code}: ${message}${details}${hint}`;
  }

  return "DB_ERROR";
}

function mapToMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    place: row.place ?? "",
    createdAt: row.created_at,
    members: (row.meeting_members ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      status: member.status,
    })),
  };
}

function meetingSelectClause(): string {
  return `
      id,
      title,
      date,
      place,
      created_at,
      owner_email,
      owner_share_token,
      meeting_members ( id, name, status )
    `;
}

export async function getMeetingOwner(meetingId: string): Promise<MeetingOwner | null> {
  const supabase = getSupabaseServerClient() as any;

  const { data, error } = await supabase
    .from("meetings")
    .select("id, owner_email, owner_share_token")
    .eq("id", meetingId)
    .single();

  if (error) {
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id as string,
    owner_email: data.owner_email as string | null,
    owner_share_token: data.owner_share_token as string | null,
  };
}

export async function getMeetings(ownerEmail?: string): Promise<Meeting[]> {
  const supabase = getSupabaseServerClient() as any;

  let query = supabase
    .from("meetings")
    .select(meetingSelectClause())
    .order("created_at", { ascending: false });

  if (ownerEmail) {
    query = query.eq("owner_email", ownerEmail);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`DB_ERROR: ${formatDbError(error)}`);
  }

  return (data as MeetingRow[] | undefined ?? []).map((row) => mapToMeeting(row));
}

export async function getMeetingsByOwnerToken(ownerToken: string): Promise<Meeting[]> {
  const supabase = getSupabaseServerClient() as any;

  const { data, error } = await supabase
    .from("meetings")
    .select(meetingSelectClause())
    .eq("owner_share_token", ownerToken)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`DB_ERROR: ${formatDbError(error)}`);
  }

  return (data as MeetingRow[] | undefined ?? []).map((row) => mapToMeeting(row));
}

export async function createMeeting(payload: NewMeetingPayload, ownerEmail: string, ownerShareToken: string): Promise<Meeting> {
  const supabase = getSupabaseServerClient() as any;
  const members = payload.members
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      status: "보류" as Attendance,
    }));

  if (members.length === 0) {
    throw new Error("MEMBER_REQUIRED");
  }

  const { data: meetingData, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      title: payload.title,
      date: payload.date,
      place: payload.place?.trim() || null,
      owner_email: ownerEmail,
      owner_share_token: ownerShareToken,
    })
    .select("id")
    .single();

  if (meetingError || !meetingData?.id) {
    throw new Error(`CREATE_MEETING_FAILED: ${meetingError ? formatDbError(meetingError) : "missing_id"}`);
  }

  const { error: memberError } = await supabase.from("meeting_members").insert(
    members.map((member) => ({
      meeting_id: meetingData.id,
      name: member.name,
      status: member.status,
    })),
  );

  if (memberError) {
    throw new Error(`CREATE_MEMBER_FAILED: ${formatDbError(memberError)}`);
  }

  const { data: finalData, error: selectError } = await supabase
    .from("meetings")
    .select(meetingSelectClause())
    .eq("id", meetingData.id)
    .single();

  if (selectError || !finalData) {
    throw new Error(`MEETING_NOT_FOUND: ${selectError ? formatDbError(selectError) : "missing_data"}`);
  }

  return mapToMeeting(finalData as MeetingRow);
}

export async function updateMemberStatus(
  meetingId: string,
  payload: UpdateMemberStatusPayload,
): Promise<Meeting> {
  const supabase = getSupabaseServerClient() as any;
  const status = toAttendance(payload.status);

  if (!status) {
    throw new Error("INVALID_STATUS");
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("meeting_members")
    .update({ status })
    .eq("meeting_id", meetingId)
    .eq("id", payload.memberId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(`UPDATE_MEMBER_FAILED: ${formatDbError(updateError)}`);
  }

  if (!updatedRows) {
    throw new Error("NOT_FOUND_MEMBER");
  }

  const { data: meetingData, error: selectError } = await supabase
    .from("meetings")
    .select(meetingSelectClause())
    .eq("id", meetingId)
    .single();

  if (selectError || !meetingData) {
    throw new Error(`NOT_FOUND_MEETING: ${selectError ? formatDbError(selectError) : "missing_data"}`);
  }

  return mapToMeeting(meetingData as MeetingRow);
}
