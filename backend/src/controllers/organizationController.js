const prisma = require("../config/prisma");

async function createOrganization(req, res) {
  try {
    const { name, slug } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof slug !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length > 60
    ) {
      return res.status(400).json({
        message: "Enter a valid organization name and lowercase slug"
      });
    }

    const organization = await prisma.$transaction(async (tx) => {
      const createdOrganization = await tx.organization.create({
        data: {
          name: name.trim(),
          slug
        }
      });

      await tx.membership.create({
        data: {
          userId: req.user.id,
          organizationId: createdOrganization.id,
          role: "ORG_ADMIN"
        }
      });

      return createdOrganization;
    });

    return res.status(201).json({
      message: "Organization created successfully",
      organization
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "Organization slug already exists"
      });
    }

    console.error("Create organization error:", error);

    return res.status(500).json({
      message: "Unable to create organization"
    });
  }
}

async function getOrganizations(req, res) {
  try {
    const memberships = await prisma.membership.findMany({
      where: {
        userId: req.user.id,
        tenantId: null
      },
      include: {
        organization: true
      }
    });

    const organizations = memberships.map((membership) => ({
      ...membership.organization,
      role: membership.role
    }));

    return res.json({ organizations });
  } catch (error) {
    console.error("Get organizations error:", error);

    return res.status(500).json({
      message: "Unable to load organizations"
    });
  }
}

module.exports = {
  createOrganization,
  getOrganizations
};
