import {
  DEFAULT_WALLET_LIMIT,
  MAX_FINGERPRINT_BASE64_LENGTH,
} from "../../lib/automations/biometrics/fingerprintProcessor";
import { runBiometricAttach } from "../../lib/automations/biometrics/attachRunner";

type ParsedArgs = Record<string, string>;

function parseArgs(argv: string[]) {
  return argv.reduce<ParsedArgs>((accumulator, item) => {
    if (!item.startsWith("--")) return accumulator;
    const [rawKey, ...rest] = item.slice(2).split("=");
    if (!rawKey) return accumulator;
    accumulator[rawKey] = rest.length > 0 ? rest.join("=") : "true";
    return accumulator;
  }, {});
}

function printUsage() {
  console.log("Uso:");
  console.log("  npx tsx scripts/biometrics/run-local-attach.ts --process-id=84 --fixture=anelar-esquerdo --mode=below");
  console.log("  npx tsx scripts/biometrics/run-local-attach.ts --protocol=220260000084 --fixture=anelar-esquerdo --mode=above --target=520000");
  console.log("");
  console.log("Parâmetros:");
  console.log("  --process-id=ID          ID do processo");
  console.log("  --protocol=PROTOCOLO     Protocolo do processo");
  console.log("  --fixture=SLUG           Fixture local de digital");
  console.log("  --finger-file=CAMINHO    Caminho absoluto da digital");
  console.log("  --index=NUMERO           Índice do dedo");
  console.log("  --format=PNG|WSQ|JPEG    Formato enviado");
  console.log("  --mode=below|above       Reduz abaixo do limite ou infla acima do alvo");
  console.log("  --target=NUMERO          Limite/alvo Base64");
  console.log("  --face-file=CAMINHO      Arquivo de face");
  console.log("  --face-fixture=SLUG      Fixture local de face");
  console.log("  --no-face=true           Envia apenas digital");
  console.log("  --host=HOST              Host da API biométrica");
  console.log("  --port=PORTA             Porta da API biométrica");
  console.log("  --user=USUARIO           Usuário da API biométrica");
  console.log("  --password=SENHA         Senha da API biométrica");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true" || args.ajuda === "true") {
    printUsage();
    return;
  }

  const result = await runBiometricAttach({
    config: {
      host: args.host,
      password: args.password,
      port: args.port ? Number(args.port) : undefined,
      user: args.user,
    },
    faceFilePath: args["face-file"] || undefined,
    faceFixture: args["face-fixture"] || undefined,
    faceIndex: args["face-index"] ? Number(args["face-index"]) : undefined,
    fingerprintFilePath: args["finger-file"] || undefined,
    fingerprintFixture: args.fixture || undefined,
    fingerprintFormat: args.format || undefined,
    fingerprintIndex: args.index ? Number(args.index) : undefined,
    includeFace: args["no-face"] !== "true",
    mode: args.mode as "above" | "below" | undefined,
    processId: args["process-id"] || args.processId,
    protocol: args.protocol,
    target: args.target ? Number(args.target) : undefined,
  });

  console.log("Execução biométrica concluída.");
  console.log(`Processo: ${result.processId}`);
  console.log(`Digital: ${result.fingerprintLabel}`);
  console.log(`Modo: ${result.mode}`);
  console.log(`Base64 final: ${result.fingerprintBase64Length}`);
  console.log(`PUT status: ${result.putStatus}`);
  console.log(`Saída: ${result.outputPath}`);
  console.log(`Limite de referência: ${MAX_FINGERPRINT_BASE64_LENGTH} | Wallet observada: ${DEFAULT_WALLET_LIMIT}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "erro desconhecido";
  console.error(`Falha no fluxo biométrico: ${message}`);
  process.exitCode = 1;
});
