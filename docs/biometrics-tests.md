# Testes biométricos

## O que foi recuperado

- Processamento de digital com controle pelo tamanho real da string Base64.
- Modo `below` para reduzir a imagem até caber no limite.
- Modo `above` para inflar a imagem e reproduzir rejeição/ausência da digital.
- Fixtures locais usando as imagens em `C:\Users\Testing Company\Pictures\Screenshots\Digitais`.

## Rodar testes automatizados

```bash
npm run test:biometrics
```

Esse comando valida:

- utilitários de Base64
- redução de PNG
- preservação de WSQ
- cenários impossíveis
- imagens reais já presentes na pasta local de digitais

## Rodar envio real para a API

Defina a senha da API:

```bash
$env:SC_BIOMETRICS_API_PASSWORD="sua-senha"
```

Exemplo `below`:

```bash
npm run biometrics:attach -- --process-id=84 --fixture=anelar-esquerdo --mode=below
```

Exemplo `above`:

```bash
npm run biometrics:attach -- --protocol=220260000084 --fixture=anelar-esquerdo --mode=above --target=520000
```

## Argumentos úteis

- `--process-id=84`
- `--protocol=220260000084`
- `--fixture=anelar-esquerdo`
- `--finger-file=C:\caminho\digital.png`
- `--index=8`
- `--format=PNG|WSQ|JPEG`
- `--mode=below|above`
- `--target=500000`
- `--face-file=C:\caminho\face.png`
- `--no-face=true`

## Resultado da execução real

O script salva a última execução em:

```text
generated/biometrics/last-attach-result.json
```
