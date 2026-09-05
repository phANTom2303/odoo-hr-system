/**
 * A higher-order function that wraps an asynchronous Express middleware/handler.
 * @param {Function} fn - The asynchronous function to wrap.
 * Expected signature: (req, res, next) => Promise
 * @returns {import('express').RequestHandler} A standard Express middleware
 * that catches errors and forwards them to the next() function.
 * @example
 * router.get('/path', asyncHandler(async (req, res) => {
 *     const data = await fetchData();
 *     res.send(data);
 * }));
 */
const asyncHandler = (fn) => (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
