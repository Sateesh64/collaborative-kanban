const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

async function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required"
    });
  }

  const token = authorization.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        message: "Invalid authentication token"
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    if (!user) {
      return res.status(401).json({
        message: "User no longer exists"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Session expired. Please log in again."
      });
    }

    if (error.name === "JsonWebTokenError" ||
        error.name === "NotBeforeError") {
      return res.status(401).json({
        message: "Invalid authentication token"
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      message: "Unable to authenticate request"
    });
  }
}

module.exports = authMiddleware;
