'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { saveTestExecutionResult } = require('../src/testExecutionStore');

const HOST_PADRAO = '172.16.1.146';
const PORTA_PADRAO = 8100;
const USUARIO_PADRAO = 'admin';
const SENHA_PADRAO = process.env.WALLET_API_SENHA || '';
// ============================================================
// Utilidades básicas
// ============================================================

function textoExiste(valor) {
  // Retorna true quando existe um texto preenchido de verdade.
  return typeof valor === 'string' && valor.trim() !== '';
}

// ============================================================
// Entrada e configuração
// ============================================================

function lerArgumentos(argumentos) {
  // Lê o que foi digitado no terminal e transforma em um objeto facil de usar.
  const opcoes = {};

  for (const argumento of argumentos) {
    if (!argumento.startsWith('--')) {
      continue;
    }

    const semPrefixo = argumento.slice(2);
    const indiceSeparador = semPrefixo.indexOf('=');

    if (indiceSeparador === -1) {
      opcoes[semPrefixo] = 'true';
      continue;
    }

    const chave = semPrefixo.slice(0, indiceSeparador);
    const valor = semPrefixo.slice(indiceSeparador + 1);
    opcoes[chave] = valor;
  }

  return opcoes;
}

function criarConfiguracao(opcoes) {
  // Monta os dados de conexao com a API.
  // Se o usuario nao informar nada, usa os valores padrao ja definidos no arquivo.
  return {
    host: opcoes.host || HOST_PADRAO,
    porta: Number(opcoes.porta || PORTA_PADRAO),
    usuario: opcoes.usuario || USUARIO_PADRAO,
    senha: opcoes.senha || SENHA_PADRAO,
  };
}

function validarConfiguracao(configuracao) {
  // Evita publicar segredo no codigo e exige a senha por argumento ou variavel de ambiente.
  if (!textoExiste(configuracao.senha)) {
    throw new Error('Informe a senha com --senha=... ou defina a variavel de ambiente WALLET_API_SENHA.');
  }
}

function criarEntrada(opcoes) {
  // Junta os dados principais do teste: arquivo, formato, dedo e processo.
  return {
    caminhoArquivo: opcoes.arquivo,
    caminhoFace: opcoes['face-arquivo'] || null,
    formato: (opcoes.formato || '').toUpperCase(),
    indice: Number(opcoes.indice),
    processoId: opcoes['processo-id'] || opcoes.processoId || null,
    protocolo: opcoes.protocolo || null,
  };
}

function validarEntrada(entrada) {
  // Confere se o minimo necessario foi informado antes de tentar chamar a API.
  if (!textoExiste(entrada.caminhoArquivo) || !Number.isFinite(entrada.indice) || !textoExiste(entrada.formato)) {
    mostrarAjuda();
    throw new Error('Parâmetros obrigatórios ausentes: --arquivo, --indice e --formato.');
  }

  if (!fs.existsSync(entrada.caminhoArquivo)) {
    throw new Error(`Arquivo não encontrado: ${entrada.caminhoArquivo}`);
  }

  if (textoExiste(entrada.caminhoFace) && !fs.existsSync(entrada.caminhoFace)) {
    throw new Error(`Arquivo de foto facial não encontrado: ${entrada.caminhoFace}`);
  }
}

// ============================================================
// Arquivo e carga da biometria
// ============================================================

function carregarArquivo(caminhoArquivo) {
  // Abre o arquivo da digital e prepara informacoes que serao usadas no log e no envio.
  const bufferArquivo = fs.readFileSync(caminhoArquivo);

  return {
    caminhoArquivo,
    nomeArquivo: path.basename(caminhoArquivo),
    bufferArquivo,
    tamanhoBytes: bufferArquivo.length,
    conteudoBase64: bufferArquivo.toString('base64'),
  };
}

function montarCargaBiometrica({ formato, indice, conteudoBase64, caminhoFace }) {
  // Monta o corpo do PUT exatamente do jeito que a API espera receber.
  // Se um arquivo de foto facial foi informado, carrega e inclui no mesmo envio.
  const itens = [
    {
      source: 'ORIGINAL',
      type: 'FINGERPRINT',
      format: formato,
      properties: { resolution: 500 },
      index: indice,
      content: conteudoBase64,
    },
  ];

  if (textoExiste(caminhoFace)) {
    const bufferFace = fs.readFileSync(caminhoFace);
    const extensaoFace = path.extname(caminhoFace).toLowerCase();
    const formatoFace = extensaoFace === '.png' ? 'PNG' : 'JPEG';
    console.log(`Foto facial: ${path.basename(caminhoFace)} (${formatoFace}, ${bufferFace.length} bytes)`);
    itens.push({
      source: 'ORIGINAL',
      type: 'FACE',
      format: formatoFace,
      index: 10,
      content: bufferFace.toString('base64'),
    });
  }

  return { data: itens };
}

// ============================================================
// Resumos e saída no terminal
// ============================================================

function resumirProcesso(dadosProcesso, indice) {
  // Pega os dados completos do processo e tira um resumo pequeno para o terminal.
  const biometrias = dadosProcesso?.biometrics || [];
  const biometriaDoIndice = biometrias.find(
    (biometria) => biometria.type === 'FINGERPRINT' && biometria.index === indice
  );

  return {
    status: dadosProcesso?.status,
    quantidadeBiometrias: biometrias.length,
    biometriaDoIndice,
  };
}

function imprimirCabecalhoExecucao(entrada) {
  // Mostra logo no começo qual arquivo e qual dedo vao ser usados.
  console.log('Iniciando anexo biométrico...');
  console.log(`Arquivo: ${entrada.caminhoArquivo}`);
  console.log(`Formato informado: ${entrada.formato}`);
  console.log(`Índice informado: ${entrada.indice}`);
}

function imprimirResumoArquivo(arquivoCarregado, processoId, protocolo) {
  // Mostra detalhes do arquivo que sera enviado para ajudar na conferência.
  console.log(`Processo alvo: ${processoId}`);
  if (protocolo) {
    console.log(`Protocolo informado: ${protocolo}`);
  }
  console.log(`Nome do arquivo: ${arquivoCarregado.nomeArquivo}`);
  console.log(`Tamanho em bytes: ${arquivoCarregado.tamanhoBytes}`);
  console.log(`Tamanho Base64: ${arquivoCarregado.conteudoBase64.length}`);
}

function imprimirResumoSituacao(titulo, resumo, indice) {
  // Mostra como o processo estava antes ou depois do PUT.
  console.log(titulo);
  console.log(`  Status: ${resumo.status}`);
  console.log(`  Quantidade de biometrias: ${resumo.quantidadeBiometrias}`);

  if (typeof indice === 'number') {
    console.log(`  Digital no índice ${indice}: ${resumo.biometriaDoIndice ? 'sim' : 'não'}`);
  }

  if (resumo.biometriaDoIndice) {
    console.log(`  Formato salvo: ${resumo.biometriaDoIndice.format}`);
    console.log(`  Tamanho do conteúdo salvo: ${(resumo.biometriaDoIndice.content || '').length}`);
  }
}

function imprimirResultadoPut(respostaPut) {
  // Mostra o resultado bruto da chamada principal de envio.
  console.log('Resultado do PUT:');
  console.log(`  Status HTTP: ${respostaPut.status}`);
  if (respostaPut.bruto) {
    console.log(`  Corpo: ${respostaPut.bruto.slice(0, 1500)}`);
  }
}

// ============================================================
// Ajuda de uso
// ============================================================

function mostrarAjuda() {
  // Exibe exemplos prontos de uso no terminal.
  console.log('Uso:');
  console.log('  node scripts/anexar_biometria.js --processo-id=88 --arquivo="C:\\\\caminho\\\\digital.wsq" --indice=3 --formato=WSQ');
  console.log('  node scripts/anexar_biometria.js --protocolo=220260000088 --arquivo="C:\\\\caminho\\\\digital.png" --indice=3 --formato=PNG');
  console.log('');
  console.log('Parâmetros:');
  console.log('  --processo-id    Id numérico do processo no SMART');
  console.log('  --protocolo      Protocolo do processo, por exemplo 220260000088');
  console.log('  --arquivo        Caminho completo do arquivo a ser anexado');
  console.log('  --indice         Índice do dedo, por exemplo 3 para anelar direito');
  console.log('  --formato        Formato enviado para a API: WSQ, PNG ou JPEG');
  console.log('  --host           Host da API. Padrão: 172.16.1.146');
  console.log('  --porta          Porta da API. Padrão: 8100');
  console.log('  --usuario        Usuário da API. Padrão: admin');
  console.log('  --senha          Senha da API. Se nao informar, usa WALLET_API_SENHA');
  console.log('  --ajuda          Mostra esta ajuda');
  console.log('');
  console.log('Observações:');
  console.log('  Este script faz apenas login, GET antes, PUT da biometria e GET depois.');
  console.log('  Ele não chama DELETE, não chama enroll e não altera o fluxo por conta própria.');
}

// ============================================================
// Comunicação com a API
// ============================================================

function criarRequisicaoApi(configuracao, token) {
  // Cria uma funcao generica para chamar a API com ou sem token.
  return function requisicaoApi({ metodo, caminho, corpo }) {
    return new Promise((resolve, reject) => {
      // Se houver corpo, transforma em JSON antes de enviar.
      const corpoTexto = corpo ? JSON.stringify(corpo) : null;
      const cabecalhos = token ? { Authorization: `Bearer ${token}` } : {};

      if (corpoTexto) {
        cabecalhos['Content-Type'] = 'application/json';
        cabecalhos['Content-Length'] = Buffer.byteLength(corpoTexto);
      }

      const requisicao = http.request(
        {
          hostname: configuracao.host,
          port: configuracao.porta,
          path: caminho,
          method: metodo,
          headers: cabecalhos,
          timeout: 60000,
        },
        (resposta) => {
          let texto = '';
          resposta.on('data', (pedaco) => {
            texto += pedaco;
          });
          resposta.on('end', () => {
            let json = null;
            try {
              json = texto ? JSON.parse(texto) : null;
            } catch (_erroIgnorado) {
              json = null;
            }

            resolve({
              status: resposta.statusCode,
              corpo: json,
              bruto: texto,
            });
          });
        }
      );

      requisicao.on('error', reject);

      if (corpoTexto) {
        requisicao.write(corpoTexto);
      }

      requisicao.end();
    });
  };
}

async function criarRequisicaoAutenticada(configuracao) {
  // Faz o login e devolve uma funcao pronta para chamar a API autenticada.
  const token = await obterToken(configuracao);
  return criarRequisicaoApi(configuracao, token);
}

async function obterToken(configuracao) {
  // Faz o login tecnico na API e pega o token de acesso.
  const requisicaoSemToken = criarRequisicaoApi(configuracao, null);
  const resposta = await requisicaoSemToken({
    metodo: 'POST',
    caminho: '/api/tokens',
    corpo: {
      data: {
        grantType: 'CREDENTIALS',
        userName: configuracao.usuario,
        userPassword: configuracao.senha,
      },
    },
  });

  const token = resposta.corpo?.data?.token;

  if (!token) {
    throw new Error(`Falha ao obter token. Status ${resposta.status}. Resposta: ${resposta.bruto}`);
  }

  return token;
}

async function localizarProcessoPorProtocolo(requisicaoApi, protocolo) {
  // Se o usuario so tiver o protocolo, tenta descobrir qual e o processId correspondente.
  const resposta = await requisicaoApi({
    metodo: 'POST',
    caminho: '/api/processos/list',
    corpo: {
      data: {
        limit: 100,
        offset: 0,
      },
    },
  });

  const processos = resposta.corpo?.data || [];
  const processo = processos.find((item) =>
    Array.isArray(item.keys) &&
    item.keys.some((chave) => (chave.id || '').toLowerCase() === 'protocol' && chave.value === protocolo)
  );

  return processo?.processId || null;
}

async function consultarProcesso(requisicaoApi, processoId) {
  // Busca o processo completo na API.
  const resposta = await requisicaoApi({
    metodo: 'GET',
    caminho: `/api/processos/${processoId}`,
  });

  return resposta.corpo?.data || {};
}

async function enviarBiometria(requisicaoApi, processoId, cargaBiometrica) {
  // Envia a digital para o processo informado.
  return requisicaoApi({
    metodo: 'PUT',
    caminho: `/api/processos/${processoId}/biometrics`,
    corpo: cargaBiometrica,
  });
}

// ============================================================
// Fluxo do processo
// ============================================================

async function obterProcessoId(requisicaoApi, entrada) {
  // Usa o processId se ele ja veio pronto.
  // Se nao vier, tenta descobrir pelo protocolo.
  if (textoExiste(entrada.processoId)) {
    return entrada.processoId;
  }

  if (textoExiste(entrada.protocolo)) {
    console.log(`Localizando processo pelo protocolo ${entrada.protocolo}...`);
    return localizarProcessoPorProtocolo(requisicaoApi, entrada.protocolo);
  }

  return null;
}

async function consultarResumoDoProcesso(requisicaoApi, processoId, indice) {
  // Busca o processo e transforma em um resumo mais facil de ler.
  const dadosProcesso = await consultarProcesso(requisicaoApi, processoId);
  return resumirProcesso(dadosProcesso, indice);
}

async function prepararExecucao(opcoes) {
  // Faz toda a preparacao antes do envio:
  // le argumentos, valida, autentica, encontra o processo e carrega o arquivo.
  const configuracao = criarConfiguracao(opcoes);
  const entrada = criarEntrada(opcoes);

  validarConfiguracao(configuracao);
  validarEntrada(entrada);
  imprimirCabecalhoExecucao(entrada);

  const requisicaoApi = await criarRequisicaoAutenticada(configuracao);
  const processoId = await obterProcessoId(requisicaoApi, entrada);

  if (!processoId) {
    throw new Error('Não foi possível determinar o processo. Informe --processo-id ou um --protocolo válido.');
  }

  const arquivoCarregado = carregarArquivo(entrada.caminhoArquivo);

  return {
    configuracao,
    entrada,
    requisicaoApi,
    processoId,
    arquivoCarregado,
  };
}

async function executarAnexo(contextoExecucao) {
  // Aqui acontece o fluxo principal do teste manual.
  const { entrada, requisicaoApi, processoId, arquivoCarregado } = contextoExecucao;

  // 1. Mostra o que sera enviado.
  imprimirResumoArquivo(arquivoCarregado, processoId, entrada.protocolo);

  // 2. Consulta como o processo esta antes do envio.
  const resumoAntes = await consultarResumoDoProcesso(requisicaoApi, processoId, entrada.indice);
  imprimirResumoSituacao('Situação antes do PUT:', resumoAntes);

  // 3. Monta o corpo da requisição com a digital em Base64 (e foto facial se fornecida).
  const carga = montarCargaBiometrica({
    formato: entrada.formato,
    indice: entrada.indice,
    conteudoBase64: arquivoCarregado.conteudoBase64,
    caminhoFace: entrada.caminhoFace,
  });

  // 4. Envia a digital para a API.
  const respostaPut = await enviarBiometria(requisicaoApi, processoId, carga);

  imprimirResultadoPut(respostaPut);

  // 5. Consulta de novo para ver como o processo ficou depois.
  const resumoDepois = await consultarResumoDoProcesso(requisicaoApi, processoId, entrada.indice);
  imprimirResumoSituacao('Situação depois do PUT:', resumoDepois, entrada.indice);

  await saveTestExecutionResult({
    dataHora: new Date().toISOString(),
    sucesso: respostaPut.status >= 200 && respostaPut.status < 300,
    processo: String(processoId),
    protocolo: entrada.protocolo,
    dedo: String(entrada.indice),
    formato: entrada.formato,
    arquivo: arquivoCarregado.caminhoArquivo,
    arquivoNome: arquivoCarregado.nomeArquivo,
    tamanhoBytes: arquivoCarregado.tamanhoBytes,
    tamanhoBase64: arquivoCarregado.conteudoBase64.length,
    putStatus: respostaPut.status,
    putResposta: respostaPut.bruto ? respostaPut.bruto.slice(0, 1500) : '',
    antes: resumoAntes,
    depois: resumoDepois,
  }, 'manual-script');
}

// ============================================================
// Execução principal
// ============================================================

async function executar() {
  // Esse e o comeco do script quando ele roda no terminal ou pelo playground.
  const opcoes = lerArgumentos(process.argv.slice(2));

  if (opcoes.ajuda || opcoes.help) {
    mostrarAjuda();
    return;
  }

  const contextoExecucao = await prepararExecucao(opcoes);
  await executarAnexo(contextoExecucao);
}

executar().catch(async (erro) => {
  // Se algo der errado, mostra uma mensagem simples e finaliza com erro.
  await saveTestExecutionResult({
    dataHora: new Date().toISOString(),
    sucesso: false,
    erro: erro.message,
  }, 'manual-script').catch(() => {});
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
});