import pino from 'pino';

const isHostedEnvironment = () => process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : "info",
  transport: isHostedEnvironment()
    ? undefined // write plain JSON to stdout in production
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: true,
          ignore: "pid,hostname",
        },
      },
});
