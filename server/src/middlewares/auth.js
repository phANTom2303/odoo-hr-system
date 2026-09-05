import jwt from 'jsonwebtoken';
export const requireAuth = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            // 1. Extract from HttpOnly Cookie
            // Requires cookie-parser middleware to be registered in Express
            const token = req.cookies?.token;

            if (!token) {
                return res.status(401).json({ message: 'Authentication required. No token provided.' });
            }

            // 2. Cryptographic Verification (Stateless CPU check)
            // Throws JsonWebTokenError or TokenExpiredError if invalid
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Cache-based Invalidation Check (Redis)
            // O(1) time complexity memory check instead of an O(log n) database query
            //   const isRevoked = await redisClient.get(`blacklist:${token}`);

            //   if (isRevoked) {
            //     return res.status(401).json({ message: 'Session revoked. Please log in again.' });
            //   }

            // 4. Stateless Role-Based Access Control
            // Only runs the check if roles were passed into the middleware factory
            if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
                return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
            }

            // 5. Context Mutation
            req.user = decoded;
            next();
        } catch (error) {
            // 6. Explicit Error Handling (Preventing 500s from masquerading as 401s)
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired.' });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Invalid token signature.' });
            }

            // Infrastructure errors (e.g., Redis connection drops) fall through to here
            console.error('[Auth Middleware Error]:', error);
            return res.status(500).json({ message: 'Internal server error during authentication.' });
        }
    };
};

export const requireOwnerOrRoles = (paramKey, ...allowedRoles) => {
    return async (req, res, next) => {
        try {
            const token = req.cookies?.token;
            if (!token) return res.status(401).json({ message: 'Authentication required. No token provided.' });

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check if user is the owner
            const resourceId = req.params[paramKey];
            const isOwner = resourceId && decoded.sub === parseInt(resourceId, 10);
            
            // Check if user has an allowed role
            const hasRole = allowedRoles.includes(decoded.role);
            
            if (!isOwner && !hasRole) {
                return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
            }

            req.user = decoded;
            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired.' });
            if (error.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token signature.' });
            console.error('[Auth Middleware Error]:', error);
            return res.status(500).json({ message: 'Internal server error during authentication.' });
        }
    };
};