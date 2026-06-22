# Ajuste local da estrutura Qase
- Escopo: preparacao local da documentacao viva em docs/qase/.
- Token Qase: nao utilizado.
- API do Qase: nao chamada.
- Sync com Qase: nao executado.
- Run: nao criada nesta etapa.
- Plano: nao criado nesta etapa.
- Cases marcados como executados: nenhum.
## Estrutura alvo aplicada localmente
`	ext
Regressao
  Login
    Acesso
    Esqueci Senha
    Solicitar Acesso - Usuario Publico
      Consulta Publica
  Solicitacoes
    Lider TC
    Suporte Tecnico
    Empresa
`
## Ajustes locais realizados
- Remocao de qualquer leitura local que tratasse a suite final de autenticacao fora de Login.
- Reclassificacao de casos de consulta e consulta-status para Regressao > Login > Solicitar Acesso - Usuario Publico > Consulta Publica.
- Normalizacao de nomenclatura para Suporte Tecnico nos documentos ASCII locais desta etapa.
- Limpeza dos relatorios locais para refletir preparacao estrutural, sem historico de sync ou run executado nesta etapa.
## Pendencias antes de sincronizar
- Confirmar ou criar o script local de sincronizacao futura.
- Disponibilizar token em momento posterior, fora desta etapa.
- Validar no Qase a arvore final antes de qualquer import ou sync.