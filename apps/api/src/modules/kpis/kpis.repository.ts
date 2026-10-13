import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const runWithResults = {
  results: { orderBy: { kpiId: 'asc' } },
} satisfies Prisma.KpiRunInclude;

export type KpiRunWithResults = Prisma.KpiRunGetPayload<{ include: typeof runWithResults }>;

// The caller supplies the run id so a retry reuses it; a duplicate id or (runId, kpiId) fails with P2002.
export type CreateKpiRunData = Omit<Prisma.KpiRunCreateInput, 'id' | 'results'> & {
  id: string;
  results: Prisma.KpiResultCreateManyRunInput[];
};

@Injectable()
export class KpisRepository {
  constructor(private readonly prisma: PrismaService) {}

  // A nested create runs in a single transaction: either the run and every result persist, or nothing does.
  createRunWithResults({ results, ...run }: CreateKpiRunData): Promise<KpiRunWithResults> {
    return this.prisma.kpiRun.create({
      data: { ...run, results: { createMany: { data: results } } },
      include: runWithResults,
    });
  }

  findRunById(id: string): Promise<KpiRunWithResults | null> {
    return this.prisma.kpiRun.findUnique({ where: { id }, include: runWithResults });
  }
}
