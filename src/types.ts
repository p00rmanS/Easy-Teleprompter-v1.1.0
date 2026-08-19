import type { PracticeResult } from "./core";

export type Role = "staff" | "manager" | "admin";

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  employeeId: string;
  venueId: string;
  role: Role;
};

export type CloudPracticeResult = PracticeResult & {
  uid: string;
  employeeId: string;
  employeeName: string;
  venueId: string;
  scriptId: string | null;
  scriptTitle: string;
  /** The Realtime Database push key. Only present on results read back from Firebase, never set on write. */
  resultId?: string;
};
