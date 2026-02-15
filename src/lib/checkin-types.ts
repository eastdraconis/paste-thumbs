export type Attendance = "참석" | "불참" | "보류";

export type Member = {
  id: string;
  name: string;
  status: Attendance;
};

export type Meeting = {
  id: string;
  title: string;
  date: string;
  place: string;
  members: Member[];
  createdAt: string;
  shareToken: string;
};

export type NewMeetingPayload = {
  title: string;
  date: string;
  place?: string;
  members: string[];
};

export type UpdateMemberStatusPayload = {
  memberId: string;
  status: Attendance;
};
