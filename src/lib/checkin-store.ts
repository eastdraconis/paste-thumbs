/* eslint-disable @typescript-eslint/no-explicit-any */
import { Attendance, Meeting, NewMeetingPayload, UpdateMemberStatusPayload } from "./checkin-types";
import { getSupabaseServerClient } from "./supabase";

type MeetingRow = {
  id: string;
  title: string;
  date: string;
  place: string | null;
  created_at: string;
  meeting_members: {
    id: string;
    name: string;
    status: Attendance;
  }[];
};

function toAttendance(value: string): Attendance | undefined {
  if (value === "참석" || value === "불참" || value === "보류") {
    return value;
  }

  return undefined;
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

export async function getMeetings(): Promise<Meeting[]> {
  const supabase = getSupabaseServerClient() as any;

  const { data, error } = await supabase
    .from("meetings")
    .select(
      `
      id,
      title,
      date,
      place,
      created_at,
      meeting_members ( id, name, status )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("DB_ERROR");
  }

  return (data as MeetingRow[] | undefined ?? []).map((row) => mapToMeeting(row));
}

export async function createMeeting(payload: NewMeetingPayload): Promise<Meeting> {
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
    })
    .select("id")
    .single();

  if (meetingError || !meetingData?.id) {
    throw new Error("CREATE_MEETING_FAILED");
  }

  const { error: memberError } = await supabase.from("meeting_members").insert(
    members.map((member) => ({
      meeting_id: meetingData.id,
      name: member.name,
      status: member.status,
    })),
  );

  if (memberError) {
    throw new Error("CREATE_MEMBER_FAILED");
  }

  const { data: finalData, error: selectError } = await supabase
    .from("meetings")
    .select(
      `
      id,
      title,
      date,
      place,
      created_at,
      meeting_members ( id, name, status )
    `,
    )
    .eq("id", meetingData.id)
    .single();

  if (selectError || !finalData) {
    throw new Error("MEETING_NOT_FOUND");
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
    throw new Error("UPDATE_MEMBER_FAILED");
  }

  if (!updatedRows) {
    throw new Error("NOT_FOUND_MEMBER");
  }

  const { data: meetingData, error: selectError } = await supabase
    .from("meetings")
    .select(
      `
      id,
      title,
      date,
      place,
      created_at,
      meeting_members ( id, name, status )
    `,
    )
    .eq("id", meetingId)
    .single();

  if (selectError || !meetingData) {
    throw new Error("NOT_FOUND_MEETING");
  }

  return mapToMeeting(meetingData as MeetingRow);
}
