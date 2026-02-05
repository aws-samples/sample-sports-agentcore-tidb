import { mysqlTable, int, varchar, text, timestamp, index, customType } from 'drizzle-orm/mysql-core';

// Custom vector type for TiDB
const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `VECTOR(${config?.dimensions ?? 1024})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const nflEmbeddings = mysqlTable('nfl_embeddings', {
  id: int('id').primaryKey().autoincrement(),
  teamName: varchar('team_name', { length: 255 }).notNull(),
  chunkText: text('chunk_text').notNull(),
  embedding: vector('embedding', { dimensions: 1024 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_team_name').on(table.teamName),
]);

export type NflEmbedding = typeof nflEmbeddings.$inferSelect;
export type NewNflEmbedding = typeof nflEmbeddings.$inferInsert;
