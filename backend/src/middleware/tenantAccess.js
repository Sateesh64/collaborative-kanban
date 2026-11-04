const prisma = require("../config/prisma");

async function requireTenantAccess(req, res, next) {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        message: "Tenant ID is required"
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        organizationId: true
      }
    });

    if (!tenant) {
      return res.status(404).json({
        message: "Tenant not found"
      });
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId: req.user.id,
        organizationId: tenant.organizationId,
        OR: [
          {
            tenantId: null,
            role: "ORG_ADMIN"
          },
          {
            tenantId: tenant.id,
            role: {
              in: ["TENANT_ADMIN", "MEMBER"]
            }
          }
        ]
      }
    });

    if (!membership) {
      return res.status(403).json({
        message: "You do not have access to this tenant"
      });
    }

    req.tenant = tenant;
    req.membership = membership;

    next();
  } catch (error) {
    console.error("Tenant access error:", error);

    return res.status(500).json({
      message: "Unable to verify tenant access"
    });
  }
}

module.exports = requireTenantAccess;
