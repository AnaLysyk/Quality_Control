// Exibe somente presença/ausência. Nunca imprima URLs de banco, pois contêm credenciais.
require("dotenv").config({ path: ".env.local" });

function status(name) {
  return process.env[name]?.trim() ? "configurada" : "ausente";
}

console.log("DATABASE_URL:", status("DATABASE_URL"));
console.log("POSTGRES_PRISMA_URL:", status("POSTGRES_PRISMA_URL"));
console.log("NODE_ENV:", process.env.NODE_ENV || "ausente");
