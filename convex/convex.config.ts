import { defineApp } from "convex/server";
import convexKindeBilling from "convex-kinde-billing/convex.config";

const app = defineApp();
app.use(convexKindeBilling);

export default app;
