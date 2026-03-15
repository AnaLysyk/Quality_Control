process.env.DATABASE_URL = "postgresql://quality_control_db_gepu_user:IcFolaph4EJDkMRFjBR7ZjCL4yb9WlPj@dpg-d6r33ohj16oc73f058g0-a.oregon-postgres.render.com/quality_control_db_gepu?sslmode=require";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const totalUsers = await prisma.user.count();
  const totalCompanies = await prisma.company.count();
  const totalTickets = await prisma.ticket.count();
  const totalRequests = await prisma.accessRequest.count();
  console.log("=== Contagem de registros no PostgreSQL de producao ===");
  console.log("users:", totalUsers);
  console.log("companies:", totalCompanies);
  console.log("tickets:", totalTickets);
  console.log("access_requests:", totalRequests);

  if (totalUsers > 0) {
    const recent = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, full_name: true, user: true, email: true, role: true, is_global_admin: true, globalRole: true, createdAt: true },
    });
    console.log("\nUltimos 5 usuarios:");
    console.log(JSON.stringify(recent, null, 2));

    const thiago = await prisma.user.findMany({
      where: { OR: [{ full_name: { contains: "thiago", mode: "insensitive" } }, { name: { contains: "thiago", mode: "insensitive" } }] },
      select: { id: true, name: true, full_name: true, user: true, email: true, role: true, is_global_admin: true, globalRole: true, createdAt: true },
    });
    console.log(`\nThiago encontrado: ${thiago.length} registro(s)`);
    if (thiago.length > 0) console.log(JSON.stringify(thiago, null, 2));
  }
} catch (err) {
  console.error("Erro:", err.message);
} finally {
  await prisma.$disconnect();
}
