import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily("weekly idea scans", { hourUTC: 7, minuteUTC: 0 }, internal.ideas.scheduleWeekly);
crons.weekly("weekly recaps", { dayOfWeek: "friday", hourUTC: 16, minuteUTC: 0 }, internal.recaps.buildAll);
crons.hourly("expire Slack sign-in states", { minuteUTC: 15 }, internal.slack.expireStates);

crons.daily("prune old analytics events", { hourUTC: 3, minuteUTC: 30 }, internal.analytics.prune);

crons.hourly("sync CRM conversions", { minuteUTC: 40 }, internal.crm.syncAll);
crons.daily("apply source retention", { hourUTC: 2, minuteUTC: 10 }, internal.insights.applyRetention);

export default crons;
