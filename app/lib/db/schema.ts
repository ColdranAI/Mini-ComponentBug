import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from "drizzle-orm/pg-core";

export const bugReports = pgTable("bug_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  pageUrl: text("page_url").notNull(),
  userAgent: text("user_agent").notNull(),
  videoUrl: text("video_url"),
  status: text("status").default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  
  // Metadata
  targetRegion: jsonb("target_region"),
  capturedElements: jsonb("captured_elements"),
  environment: jsonb("environment"),
}, (table) => ({
  createdAtIdx: index("bug_reports_created_at_idx").on(table.createdAt),
  statusIdx: index("bug_reports_status_idx").on(table.status),
}));

export const networkRequests = pgTable("network_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  bugReportId: uuid("bug_report_id").notNull().references(() => bugReports.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull(),
  url: text("url").notNull(),
  method: text("method").notNull(),
  status: integer("status"),
  statusText: text("status_text"),
  error: text("error"),
  duration: integer("duration"),
  timestamp: timestamp("timestamp").notNull(),
  
  // Request/Response data
  requestHeaders: jsonb("request_headers"),
  requestBody: jsonb("request_body"), 
  responseHeaders: jsonb("response_headers"),
  responseBody: jsonb("response_body"),
  
  // Flags for quick filtering
  isFailed: boolean("is_failed").default(false).notNull(),
}, (table) => ({
  bugReportIdx: index("network_requests_bug_report_idx").on(table.bugReportId),
  failedIdx: index("network_requests_failed_idx").on(table.isFailed),
  timestampIdx: index("network_requests_timestamp_idx").on(table.timestamp),
}));

export const consoleLogs = pgTable("console_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  bugReportId: uuid("bug_report_id").notNull().references(() => bugReports.id, { onDelete: "cascade" }),
  level: text("level").notNull(), // log, info, warn, error, debug
  message: text("message").notNull(),
  args: jsonb("args"),
  timestamp: timestamp("timestamp").notNull(),
  
  // Flags for quick filtering
  isError: boolean("is_error").default(false).notNull(),
}, (table) => ({
  bugReportIdx: index("console_logs_bug_report_idx").on(table.bugReportId),
  levelIdx: index("console_logs_level_idx").on(table.level),
  errorIdx: index("console_logs_error_idx").on(table.isError),
  timestampIdx: index("console_logs_timestamp_idx").on(table.timestamp),
}));

export type BugReport = typeof bugReports.$inferSelect;
export type NewBugReport = typeof bugReports.$inferInsert;
export type NetworkRequest = typeof networkRequests.$inferSelect;
export type NewNetworkRequest = typeof networkRequests.$inferInsert;
export type ConsoleLog = typeof consoleLogs.$inferSelect;
export type NewConsoleLog = typeof consoleLogs.$inferInsert;
