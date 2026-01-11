 
const fs = require("fs");
const path = require("path");

class RelatorioPortuguesReporter {
  constructor(globalConfig, options = {}) {
    this.globalConfig = globalConfig;
    this.options = options;
  }

  onRunComplete(_contexts, results) {
    const tempoTotalMs = results.testResults.reduce((acc, suite) => acc + (suite.perfStats?.runtime ?? 0), 0);
    const falhasDetalhadas = [];

    results.testResults.forEach((suite) => {
      suite.testResults
        .filter((t) => t.status === "failed")
        .forEach((teste) => {
          falhasDetalhadas.push({
            arquivo: path.relative(process.cwd(), suite.testFilePath),
            titulo: teste.fullName,
            mensagens: teste.failureMessages,
          });
        });
    });

    const linhas = [];
    linhas.push("# Relatório de Testes Automatizados");
    linhas.push("");
    linhas.push(`Data de execução: ${new Date().toLocaleString("pt-BR")}`);
    linhas.push("");
    linhas.push("## Resumo Executivo");
    linhas.push(
      `Status geral: ${results.numFailedTests === 0 ? "Aprovado" : "Falhas encontradas"}. ${
        results.numFailedTests === 0
          ? "Todos os cenários passaram com sucesso."
          : "Existem cenários que precisam de correção."
      }`
    );
    linhas.push(
      `Testes: ${results.numPassedTests} aprovados | ${results.numFailedTests} falharam | ${results.numPendingTests} pendentes`
    );
    linhas.push(`Suites executadas: ${results.numTotalTestSuites}`);
    linhas.push(`Tempo total: ${(tempoTotalMs / 1000).toFixed(2)}s`);
    linhas.push("");
    linhas.push("## Destaques");
    linhas.push("- Cobertura qualitativa: execução alinhada ao escopo atual de testes.");
    linhas.push("- Resultados exportados automaticamente para compartilhamento rápido.");
    linhas.push("");
    linhas.push("## Cenários Executados");
    results.testResults.forEach((suite) => {
      const arquivo = path.relative(process.cwd(), suite.testFilePath);
      linhas.push(`- ${arquivo}: ${suite.numPassingTests} aprovados, ${suite.numFailingTests} falhas, ${suite.numPendingTests} pendentes`);
    });
    linhas.push("");

    if (falhasDetalhadas.length > 0) {
      linhas.push("## Falhas Encontradas");
      falhasDetalhadas.forEach((falha, index) => {
        linhas.push(`${index + 1}. Arquivo: ${falha.arquivo}`);
        linhas.push(`   Cenário: ${falha.titulo}`);
        falha.mensagens.forEach((mensagem) => {
          const mensagemLimpa = mensagem.replace(/\u001b\[.*?m/g, "").trim();
          linhas.push(`   Detalhe: ${mensagemLimpa}`);
        });
        linhas.push("");
      });
    } else {
      linhas.push("## Falhas Encontradas");
      linhas.push("Nenhuma falha registrada na execução.");
      linhas.push("");
    }

    linhas.push("## Próximos Passos Recomendados");
    if (falhasDetalhadas.length > 0) {
      linhas.push("- Priorizar a correção das falhas listadas acima e reexecutar a suíte.");
    } else {
      linhas.push("- Manter a cadência de execuções automatizadas para garantir estabilidade contínua.");
    }
    linhas.push("- Avaliar inclusão de cenários adicionais de integração quando necessário.");

    const pasta = path.join(process.cwd(), "test-results");
    const arquivo = path.join(pasta, "relatorio-testes.md");
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(arquivo, linhas.join("\n"), "utf8");
     
    console.log(`Relatório de testes gerado em: ${path.relative(process.cwd(), arquivo)}`);
  }
}

module.exports = RelatorioPortuguesReporter;
