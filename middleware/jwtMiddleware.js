import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  let token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access Denied: No token provided",
    });
  }

  // Handle standard Bearer token formatting
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }

  try {
    const secret = process.env.JWT_SECRET || "Abcd12345678!?";
    const verified = jwt.verify(token, secret);
    req.user = verified;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "InValid Token: Signature verification failed or token expired",
    });
  }
};

/**
 * Role-Based Access Control (RBAC) middleware generator
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const userRole = req.user.role || 'customer';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of [${allowedRoles.join(', ')}] roles`,
      });
    }
    next();
  };
};

export const adminOnly = requireRole('admin');
export const vendorOrAdmin = requireRole('vendor', 'admin');

export default authMiddleware;
