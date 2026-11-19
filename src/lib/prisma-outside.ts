// Client for the SEPARATE Outside Tasks database (prisma/outside-tasks/schema.prisma).
// Generated into src/generated/outside-client by `npm install` (postinstall).
import { PrismaClient } from "@/generated/outside-client";

const globalForOutside = globalThis as unknown as { prismaOutside?: PrismaClient };

export const outsideTasksConfigured = Boolean(process.env.OUTSIDE_TASKS_DATABASE_URL);

export const prismaOutside = globalForOutside.prismaOutside ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForOutside.prismaOutside = prismaOutside;
}
