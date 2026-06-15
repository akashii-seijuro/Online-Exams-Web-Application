import { Worker } from "bullmq";

import { redis } from "../../config/redis.js";

export const cleanupWorker = new Worker(
  "cleanup",
  async (job) => ({
    id: job.id,
    status: "completed"
  }),
  { connection: redis }
);
