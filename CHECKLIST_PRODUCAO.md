# Checklist de Producao: Quality Control

1. Copie este arquivo para `.env.production` na raiz do projeto.
2. Preencha os valores reais do ambiente:

JWT_SECRET=uma_chave_forte
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
QASE_API_TOKEN=token_qase
QASE_PROJECT_MAP=griaule:GRIAULE

3. No Vercel, acesse Settings > Environment Variables e cadastre as mesmas variaveis.
4. Faca o deploy do app.
5. Confirme que as variaveis estao corretas no painel do Vercel.
6. Rode os testes de producao para validar o ambiente.

Se precisar de script de validacao ou seed de dados, solicite.
