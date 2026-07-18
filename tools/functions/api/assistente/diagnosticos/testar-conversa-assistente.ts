import { InternalBrainEngine } from "@/backend/brain/internalEngine";

type Case = {
  name: string;
  message: string;
  expects: string[];
  rejects?: string[];
};

const cases: Case[] = [
  {
    name: "greeting",
    message: "oi",
    expects: ["O que você quer resolver agora", "Tudo certo"],
    rejects: ["###", "Defeitos", "Memórias"],
  },
  {
    name: "thanks",
    message: "valeu",
    expects: ["Disponha", "próximo passo"],
    rejects: ["###", "Diagnóstico"],
  },
  {
    name: "help",
    message: "me ajuda",
    expects: ["Claro", "uma frase"],
    rejects: ["###", "Análise"],
  },
];

async function runCase(tc: Case) {
  const engine = new InternalBrainEngine();
  let text = "";

  for await (const event of engine.run({
    messages: [{ role: "user", content: tc.message }],
    screenLabel: "Dashboard",
  })) {
    if (event.type === "text-delta") text += event.text;
    if (event.type === "error") {
      throw new Error(`Engine error: ${event.error}`);
    }
  }

  const normalized = text.toLowerCase();
  const missing = tc.expects.filter((item) => !normalized.includes(item.toLowerCase()));
  const forbidden = (tc.rejects ?? []).filter((item) => normalized.includes(item.toLowerCase()));

  return {
    name: tc.name,
    ok: missing.length === 0 && forbidden.length === 0,
    missing,
    forbidden,
    text,
  };
}

async function main() {
  const results = [];
  for (const tc of cases) {
    results.push(await runCase(tc));
  }

  for (const result of results) {
    console.log(`\n[${result.ok ? "PASS" : "FAIL"}] ${result.name}`);
    if (result.missing.length) console.log(`  missing: ${result.missing.join(", ")}`);
    if (result.forbidden.length) console.log(`  forbidden: ${result.forbidden.join(", ")}`);
    console.log(`  reply: ${result.text.replace(/\s+/g, " ").trim()}`);
  }

  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

