/**
 * Projects and memberships. Mirrors backend/models/project*.py.
 */

import { Role, RoleStatus } from "./rbac.types";

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: Role;
  status: RoleStatus;
  invitedBy?: string;
  createdAt: string;
}

export interface ProjectStats {
  totalRuns: number;
  completedRuns: number;
  totalReports: number;
  totalSources: number;
  contradictionsFound: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  membersCount: number;
  stats: ProjectStats;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
