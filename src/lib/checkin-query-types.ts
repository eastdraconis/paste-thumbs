import { Attendance } from "@/lib/checkin-types";

export type ViewMode = "personal" | "shared";

export type MeetingsParams = {
  ownerToken: string;
  isSharedMode: boolean;
};

export type CreateMeetingInput = {
  title: string;
  date: string;
  place?: string;
  members: string[];
};

export type UpdateMeetingStatusInput = {
  meetingId: string;
  memberId: string;
  status: Attendance;
  ownerToken: string;
  isSharedMode: boolean;
};
