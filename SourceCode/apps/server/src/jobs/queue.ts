import { Queue } from "bullmq";

import { redis } from "../config/redis.js";

export const reportQueue = new Queue("reports", {
  connection: redis
});
