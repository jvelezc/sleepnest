import { pgTable, text, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const feedings = pgTable("feedings", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  feedingType: text("feeding_type").notNull(), // breast, bottle, solids
  duration: integer("duration").notNull(), // in minutes
  amount: real("amount"), // in ounces, optional for bottle feeding
  notes: text("notes")
});

export const sleep = pgTable("sleep", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  sleepType: text("sleep_type").notNull(), // nap or night
  notes: text("notes")
});

export const insertFeedingSchema = createInsertSchema(feedings);
export const selectFeedingSchema = createSelectSchema(feedings);
export type InsertFeeding = z.infer<typeof insertFeedingSchema>;
export type Feeding = z.infer<typeof selectFeedingSchema>;

export const insertSleepSchema = createInsertSchema(sleep);
export const selectSleepSchema = createSelectSchema(sleep);
export type InsertSleep = z.infer<typeof insertSleepSchema>;
export type Sleep = z.infer<typeof selectSleepSchema>;
