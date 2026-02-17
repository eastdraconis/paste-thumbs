import { fetchJson } from "@/lib/api-client";
import { Meeting } from "@/lib/checkin-types";
import {
  CreateMeetingInput,
  MeetingsParams,
  UpdateMeetingStatusInput,
} from "@/lib/checkin-query-types";

function buildApiUrl(path: string, token?: string, isSharedMode = false) {
  if (!token) {
    return path;
  }

  const queryKey = isSharedMode ? "meetingToken" : "ownerToken";
  return `${path}?${queryKey}=${encodeURIComponent(token)}`;
}

export function fetchAuthProviders() {
  return fetchJson<Record<string, unknown>>("/api/auth/providers");
}

export function fetchMeetings({ ownerToken, isSharedMode }: MeetingsParams) {
  return fetchJson<Meeting[]>(buildApiUrl("/api/meetings", ownerToken, isSharedMode));
}

export function createMeeting(input: CreateMeetingInput) {
  return fetchJson<Meeting>("/api/meetings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export function updateMeetingStatus({
  meetingId,
  memberId,
  status,
  ownerToken,
  isSharedMode,
}: UpdateMeetingStatusInput) {
  return fetchJson<Meeting>(buildApiUrl(`/api/meetings/${meetingId}`, ownerToken, isSharedMode), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ memberId, status }),
  });
}
