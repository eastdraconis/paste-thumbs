import { ViewMode } from "@/lib/checkin-query-types";

export const checkinQueryKeys = {
  authProviders: ["auth-providers"] as const,
  meetings: (mode: ViewMode, ownerToken: string) =>
    ["meetings", mode, ownerToken] as const,
};
