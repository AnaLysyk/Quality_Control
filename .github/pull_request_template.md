## Resumo

Descreva a mudanca e o fluxo afetado.

## Checklist de permissao para telas novas

- [ ] A tela foi registrada no catalogo central (`SYSTEM_ROUTES`)?
- [ ] A rota visual possui `requiredPermission`?
- [ ] O menu/card/botao usa a permissao para ocultar no front?
- [ ] Toda API sensivel usa `requirePermission` ou helper equivalente no servidor?
- [ ] A regra respeita contexto de empresa e escopo global quando aplicavel?
- [ ] Existe teste de acesso permitido?
- [ ] Existe teste de acesso negado?
- [ ] Existe teste de URL direta ou API direta retornando 403?
- [ ] A permissao usada existe em `PERMISSION_MODULES`?
- [ ] O cenario manual foi documentado em `docs/PERMISSOES_CENTRAL_QUALITY_CONTROL.md` ou documento funcional equivalente?

## Validacao

- [ ] `npm run typecheck`
- [ ] `npm run guard:permissions-catalog`
- [ ] `npm run test:permissions`
