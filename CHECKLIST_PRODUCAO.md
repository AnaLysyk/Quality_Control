# Checklist de Produção: painel-qa

1. Copie este arquivo para `.env.production` na raiz do projeto.
2. Preencha os valores reais do ambiente:

JWT_SECRET=uma_chave_forte
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
QASE_API_TOKEN=token_qase
QASE_PROJECT_MAP=griaule:GRIAULE

3. No Vercel, acesse Settings > Environment Variables e cadastre as mesmas variáveis.
4. Faça o deploy do app.
5. Confirme que as variáveis estão corretas no painel do Vercel.
6. Rode os testes de produção para validar o ambiente.

Se precisar de script de validação ou seed de dados, solicite!
