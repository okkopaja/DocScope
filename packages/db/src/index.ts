import process from 'node:process';
import { PrismaClient } from '@prisma/client';// Re-export the Prisma client for use across packages
export type { PrismaClient };

// Singleton pattern to avoid multiple instances during development
let prismaClient: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaClient;
}

export async function disconnectDb(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = undefined;
  }
}

// Re-export Prisma types for convenience
export * from '@prisma/client';
