const prisma = require("../config/prisma");

async function requireOrganizationAccess(req, res, next) {
  try {
    const { organizationId } = req.params;

    const membership = await prisma.membership.findFirst({
      where: {
        userId: req.user.id,
        organizationId,
        tenantId: null,
        role: "ORG_ADMIN"
      }
    });

    if (!membership) {
      return res.status(403).json({
        message: "Organization admin access required"
      });
    }

    next();
  } catch (error) {
    console.error("Organization access error:", error);
    res.status(500).json({
      message: "Unable to verify organization access"
    });
  }
}

module.exports = requireOrganizationAccess;
