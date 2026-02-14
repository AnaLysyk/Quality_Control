import { NextResponse } from "next/server";
// Importa prisma só em ambiente Node/server
let prisma: typeof import("@/lib/prismaClient").prisma | undefined;
if (typeof process !== "undefined" && process.release?.name === "node") {
  prisma = require("@/lib/prismaClient").prisma;
}
import { authenticateRequest } from "@/lib/jwtAuth";

type Payload = {
  email?: string;
  company?: string;
  role?: string;
  name?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const email = body.email?.toLowerCase().trim();
  const company = (body.company || "").trim();
  const role = (body.role || "").trim();
  const name = (body.name || "").trim();

  // Simple email format validation
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!email || !emailRegex.test(email)) {
    return NextResponse.json(
      { message: "E-mail inválido ou ausente" },
      { status: 400 },
    );
  }
  if (!company || !role || !name) {
    return NextResponse.json(
      { message: "Empresa, cargo e nome são obrigatórios" },
      { status: 400 },
    );
  }

  // Block obvious abuse (e.g., too short/long fields)
  if (company.length < 2 || company.length > 255 || name.length < 2 || name.length > 255) {
    return NextResponse.json(
      { message: "Nome e empresa devem ter entre 2 e 255 caracteres" },
      { status: 400 },
    );
  }

  const message = [
    "Solicitacao de acesso ao admin",
    `Empresa: ${company}`,
    `Cargo: ${role}`,
    `Nome: ${name}`,
    `Email: ${email}`,
  ].join("\n");

  // Identifica usuário autenticado (se houver) para preencher user_id
  const authUser = await authenticateRequest(req);
  const userId = authUser?.id ?? null;

  // Contexto técnico (audit)
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;

  // Audit log
  console.info("[FORGOT_PASSWORD_REQUEST]", { email, company, name, ip_address, user_agent, userId });

  try {
    if (prisma) {
      await prisma.supportRequest.create({
        data: {
          email,
          message,
          status: "open",
          ip_address,
          user_agent,
          user_id: userId,
        },
      });
    }
  } catch (err) {
    // Não vaza detalhes; apenas loga no servidor
    console.error("Erro ao registrar support_request:", err);
  }

  return NextResponse.json({
    ok: true,
    message: "Solicitacao enviada. O administrador sera notificado.",
  });
}
