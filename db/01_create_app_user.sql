-- =============================================================================
--  Minas Farma - Criação de usuário de aplicação (homologação)
-- =============================================================================
--  OBJETIVO:
--    Criar um usuário DEDICADO para a aplicação, com permissão de LER, GRAVAR
--    e CRIAR as tabelas da própria aplicação no banco hml_minas_farma.
--
--  SEGURANÇA (o que este script NÃO faz):
--    - NÃO é superusuário, NÃO tem CREATEDB, NÃO tem CREATEROLE.
--      => Não consegue DROPAR nem RECRIAR o banco (só o dono/superusuário pode).
--    - NÃO revoga nada de nenhum outro usuário. É 100% ADITIVO.
--      => bkp_hml, cirano, vision, postgres e rotinas de backup continuam
--         funcionando exatamente como antes. Ninguém deixa de inserir dados.
--
--  COMO RODAR (no servidor, como postgres):
--    psql -U postgres -d hml_minas_farma -f 01_create_app_user.sql
--  ou, colando o conteúdo no seu cliente SQL conectado como postgres.
-- =============================================================================

-- 1) Cria o papel de login da aplicação (sem privilégios administrativos).
--    Se já existir, apenas atualiza a senha.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'minasfarma_app') THEN
        CREATE ROLE minasfarma_app LOGIN PASSWORD 'DEFINA_UMA_SENHA_FORTE_AQUI'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    ELSE
        ALTER ROLE minasfarma_app WITH LOGIN PASSWORD 'DEFINA_UMA_SENHA_FORTE_AQUI'
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
END
$$;

-- 2) Permite conectar ao banco.
GRANT CONNECT ON DATABASE hml_minas_farma TO minasfarma_app;

-- 3) Permite USAR o schema public e CRIAR objetos nele (tabelas novas da app).
GRANT USAGE, CREATE ON SCHEMA public TO minasfarma_app;

-- 4) Concede leitura/escrita nas TABELAS que JÁ EXISTEM (users, closings, etc.).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO minasfarma_app;

-- 5) Concede uso das SEQUENCES existentes (necessário p/ colunas serial/identity).
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO minasfarma_app;

-- 6) Garante o mesmo acesso para tabelas/sequences criadas NO FUTURO por postgres
--    (assim o app não perde acesso se algo novo for criado pelo dono).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO minasfarma_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO minasfarma_app;

-- =============================================================================
--  Verificação rápida (opcional): deve retornar 't' nas duas colunas.
-- =============================================================================
-- SELECT has_schema_privilege('minasfarma_app','public','CREATE') AS pode_criar,
--        has_schema_privilege('minasfarma_app','public','USAGE')  AS pode_usar;
