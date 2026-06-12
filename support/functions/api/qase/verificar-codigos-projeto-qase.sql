-- Verifica se a coluna qase_project_codes existe e está preenchida para uma empresa específica
-- Substitua 'SUA_EMPRESA_ID' pelo id real da empresa
SELECT id, name, qase_project_codes, qase_project_code
FROM companies
WHERE id = 'SUA_EMPRESA_ID';

-- Para listar todas as empresas e ver quais têm o array preenchido
SELECT id, name, qase_project_codes, qase_project_code
FROM companies
WHERE array_length(qase_project_codes, 1) > 0;