
import rateLimit from "express-rate-limit";
import { RateLimitError } from "../lib/errors.js";

export const rateLimitHandler = ({ windowInMinutes = 1, limit = 2 }) => {
    const windowMs = Number(windowInMinutes) * 60 * 1000;

    return rateLimit({
        windowMs,
        max: Number(limit),
        keyGenerator: (req) => req.user?._id || req.ip,
        handler: (req, res, next) => {
            const err = new RateLimitError(
                `Please Wait! You've reached your request limit. Try again in ${windowInMinutes} minute(s).`
            );
            next(err);
        },
        standardHeaders: true, // Sends RateLimit-* headers
        legacyHeaders: false, // Disables deprecated X-RateLimit-* headers
    });
};
