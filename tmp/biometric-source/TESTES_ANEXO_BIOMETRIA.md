# Teste da Digital

## Tela visual

Se voce quiser ver tudo em uma tela, abra este arquivo no navegador:

- `TELA_TESTES.html`

Se o helper estiver ligado, voce tambem pode abrir:

- `http://localhost:3030/tela-testes`

Nele voce consegue:

- ver os testes em formato visual
- escolher processo, dedo, arquivo e tipo do arquivo
- copiar os comandos prontos
- ver qual numero corresponde a cada dedo
- ver o ultimo resultado salvo do teste manual


## Opcao 1: clique no arquivo

Na pasta do projeto existe este arquivo:

- `RODAR_TESTE_DIGITAL.bat`

Se voce quiser o jeito mais facil, de dois cliques nele no Windows.

Ele vai rodar o teste da digital usando a configuracao que esta pronta no projeto.

## Opcao 2: rode no terminal

Se preferir usar o terminal, rode este comando:

```bash
npm run playground:anexar
```

## Se quiser trocar o arquivo ou o dedo

Abra este arquivo:

- `scripts/playground_anexar_biometria.js`

No comeco do arquivo, troque so estes campos:

- `processo`
- `arquivoDigital`
- `dedo`
- `tipoArquivo`

## Testes automatizados do projeto

Se voce quiser testar o codigo do projeto, e nao o envio da digital para a API, use:

```bash
npm test
```

## Resumo rapido

- Mais facil: `RODAR_TESTE_DIGITAL.bat`
- Pelo terminal: `npm run playground:anexar`
- Para trocar processo, arquivo ou dedo: `scripts/playground_anexar_biometria.js`
