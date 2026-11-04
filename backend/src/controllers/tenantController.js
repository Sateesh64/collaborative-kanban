const prisma = require("../config/prisma");

async function createTenant(req, res) {
  try {
    const { organizationId } = req.params;
    const { name, slug } = req.body || {};
    const adminMembership = await prisma.membership.findFirst({
  where: {
    userId: req.user.id,
    organizationId,
    tenantId: null,
    role: "ORG_ADMIN",
  },
  select: {
    id: true,
  },
});

if (!adminMembership) {
  return res.status(403).json({
    message: "Only organization administrators can create branches",
  });
}

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      typeof slug !== "string" ||
      slug.length > 60 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
      return res.status(400).json({
        message: "Enter a valid branch name and lowercase slug"
      });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        slug,
        organizationId
      }
    });

    return res.status(201).json({
      message: "Tenant created successfully",
      tenant
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "A tenant with this slug already exists"
      });
    }

    if (error.code === "P2003") {
      return res.status(404).json({
        message: "Organization not found"
      });
    }

    console.error("Create tenant error:", error);

    return res.status(500).json({
      message: "Unable to create tenant"
    });
  }
}

async function getTenants(req, res) {
  try {
    const { organizationId } = req.params;

    const memberships = await prisma.membership.findMany({
      where: {
        userId: req.user.id,
        organizationId
      },
      select: {
        role: true,
        tenantId: true
      }
    });

    if (memberships.length === 0) {
      return res.status(403).json({
        message: "You do not have access to this organization"
      });
    }

    const isOrgAdmin = memberships.some(
      (membership) =>
        membership.role === "ORG_ADMIN" &&
        membership.tenantId === null
    );

    const tenantIds = memberships
      .filter((membership) => membership.tenantId !== null)
      .map((membership) => membership.tenantId);

    const tenants = await prisma.tenant.findMany({
      where: {
        organizationId,
        ...(isOrgAdmin ? {} : { id: { in: tenantIds } })
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return res.json({ tenants });
  } catch (error) {
    console.error("Get tenants error:", error);

    return res.status(500).json({
      message: "Unable to load tenants"
    });
  }
}

module.exports = {
  createTenant,
  getTenants
};
