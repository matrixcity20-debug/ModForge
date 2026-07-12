import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const modRequestsTable = pgTable("mod_requests", {
  id: serial("id").primaryKey(),
  mcVersion: varchar("mc_version", { length: 32 }).notNull(),
  modLoader: varchar("mod_loader", { length: 32 }).notNull(),
  prompt: text("prompt").notNull(),
  title: text("title").notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  summary: text("summary").notNull(),
  resultMarkdown: text("result_markdown").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertModRequestSchema = createInsertSchema(
  modRequestsTable,
).omit({ id: true, createdAt: true });
export type InsertModRequest = z.infer<typeof insertModRequestSchema>;
export type ModRequestRow = typeof modRequestsTable.$inferSelect;
