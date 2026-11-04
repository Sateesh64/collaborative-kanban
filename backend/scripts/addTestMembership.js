
const prisma = require("../src/config/prisma");

async function main() {
  const userId = "65020d47-f27e-4243-a2b0-8e71ca9df294";
  const organizationId = "5782ed8d-5ec6-4406-bee4-ad55413b403b";
  const tenantId = "3798de85-1ddc-4710-8241-34bed1338186";

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!user) throw new Error("Test user not found");
  if (!tenant) throw new Error("Hyderabad tenant not found");

  if (tenant.organizationId !== organizationId) {
    throw new Error("Tenant does not belong to the organization");
  }

  const existing = await prisma.membership.findFirst({
    where: { userId, organizationId, tenantId }
  });

  if (existing) {
    console.log("Membership already exists:", existing.id);
    return;
  }

  const membership = await prisma.membership.create({
    data: {
      userId,
      organizationId,
      tenantId,
      role: "MEMBER"
    }
  });

  console.log("Hyderabad membership created successfully");
  console.log({
    id: membership.id,
    userId: membership.userId,
    tenantId: membership.tenantId,
    role: membership.role
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
