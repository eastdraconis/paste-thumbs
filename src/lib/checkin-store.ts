import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import {
  Attendance,
  Meeting,
  Member,
  NewMeetingPayload,
  UpdateMemberStatusPayload,
} from "./checkin-types";

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "meetings.json");

type Database = {
  meetings: Meeting[];
};

const initialDb: Database = {
  meetings: [],
};

async function ensureStorage(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await access(DATA_FILE, constants.F_OK);
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(initialDb, null, 2), "utf8");
  }
}

async function loadDb(): Promise<Database> {
  await ensureStorage();

  const raw = await readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || !Array.isArray(parsed.meetings)) {
    return initialDb;
  }

  return parsed;
}

async function saveDb(data: Database): Promise<void> {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function toAttendance(value: string): Attendance | undefined {
  if (value === "참석" || value === "불참" || value === "보류") {
    return value;
  }

  return undefined;
}

export async function getMeetings(): Promise<Meeting[]> {
  const db = await loadDb();
  return db.meetings;
}

export async function createMeeting(payload: NewMeetingPayload): Promise<Meeting> {
  const db = await loadDb();

  const members: Member[] = payload.members
    .map((name) => ({
      id: randomUUID(),
      name,
      status: "보류" as Attendance,
    }))
    .filter((member) => member.name.length > 0);

  const meeting: Meeting = {
    id: randomUUID(),
    title: payload.title,
    date: payload.date,
    place: payload.place ?? "",
    members,
    createdAt: new Date().toISOString(),
  };

  db.meetings.unshift(meeting);
  await saveDb(db);
  return meeting;
}

export async function updateMemberStatus(
  meetingId: string,
  payload: UpdateMemberStatusPayload,
): Promise<Meeting> {
  const db = await loadDb();
  const status = toAttendance(payload.status);

  if (!status) {
    throw new Error("INVALID_STATUS");
  }

  const meeting = db.meetings.find((item) => item.id === meetingId);

  if (!meeting) {
    throw new Error("NOT_FOUND_MEETING");
  }

  const member = meeting.members.find((entry) => entry.id === payload.memberId);

  if (!member) {
    throw new Error("NOT_FOUND_MEMBER");
  }

  member.status = status;
  await saveDb(db);
  return meeting;
}
