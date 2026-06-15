import { Worker } from "bullmq";

import { redis } from "../../config/redis.js";

export const reportWorker = new Worker(
  "reports",
  async (job) => ({
    id: job.id,
    status: "completed"
  }),
  { connection: redis }
);
