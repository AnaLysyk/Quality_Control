'use strict';

const path = require('path');
const { spawn } = require('child_process');

// Mude aqui o processo, o arquivo, o dedo e o tipo do arquivo.
const configuracao = {
  processo: '84',
  arquivoDigital: path.resolve(__dirname, '..', 'wsq_output', 'anelar_esquerdo.wsq'),
  dedo: '8',
  tipoArquivo: 'WSQ',
};

function montarArgumentos(opcoes) {
  // Este arquivo so prepara os dados e chama o script principal.
  const argumentos = ['scripts/anexar_biometria.js'];

  argumentos.push(`--processo-id=${opcoes.processo}`);

  argumentos.push(`--arquivo=${opcoes.arquivoDigital}`);
  argumentos.push(`--indice=${opcoes.dedo}`);
  argumentos.push(`--formato=${opcoes.tipoArquivo}`);

  return argumentos;
}

function executarPlayground() {
  const argumentos = montarArgumentos(configuracao);

  // Mostra na tela o que sera usado no teste.
  console.log('Executando playground de anexo biometrico...');
  console.log(`Arquivo: ${configuracao.arquivoDigital}`);
  console.log(`Dedo: ${configuracao.dedo}`);
  console.log(`Tipo do arquivo: ${configuracao.tipoArquivo}`);
  console.log(`Processo: ${configuracao.processo}`);

  // Roda o script principal e mostra tudo no mesmo terminal.
  const processo = spawn(process.execPath, argumentos, {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });

  processo.on('exit', (codigo) => {
    // Mantem o mesmo resultado final do script principal.
    process.exitCode = codigo;
  });

  processo.on('error', (erro) => {
    // Mostra erro se nem der para abrir o script principal.
    console.error(`Falha ao executar playground: ${erro.message}`);
    process.exitCode = 1;
  });
}

executarPlayground();