import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { jobBatches, telegramGroups } from '../../database/schema';

@Injectable()
export class InternalGroupsService {
  constructor(private readonly database: DatabaseService) {}

  async deleteGroupData(groupId: string): Promise<{
    groupId: string;
    deletedGroup: boolean;
    deletedJobBatches: number;
  }> {
    return this.database.db.transaction(async (tx) => {
      const deletedJobBatches = await tx
        .delete(jobBatches)
        .where(eq(jobBatches.groupId, groupId))
        .returning({ id: jobBatches.id });

      const deletedGroups = await tx
        .delete(telegramGroups)
        .where(eq(telegramGroups.id, groupId))
        .returning({ id: telegramGroups.id });

      return {
        groupId,
        deletedGroup: deletedGroups.length > 0,
        deletedJobBatches: deletedJobBatches.length,
      };
    });
  }
}
