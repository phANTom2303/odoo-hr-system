import { createClient } from 'redis';
import { logger } from '#config/logger.js';

let redisClient;

export const initRedis = async () => {
  redisClient = createClient({
    url: process.env.REDIS_URL,
  });

  redisClient.on('error', (err) => logger.error(`Redis Client Error: ${err}`));
  redisClient.on('connect', () => logger.info('Redis Client Connected'));

  try {
    await redisClient.connect();
  } catch (error) {
    logger.error(`Failed to connect to Redis: ${error}`);
  }

  return redisClient;
};

export const getRedisClient = () => {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call initRedis first.');
    }
    return redisClient;
};