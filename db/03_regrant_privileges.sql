-- =============================================================================
--  Minas Farma - RE-CONCEDER privilégios ao minasfarma_app
-- =============================================================================
--  QUANDO USAR: se o login parar (erro 500 / "permission denied for table ...")
--  depois de uma rotina de backup/restore. Um restore que recria o schema como
--  postgres APAGA os GRANTs por-banco do minasfarma_app (o papel e a senha
--  continuam existindo - são do cluster, não do banco).
--
--  Este script SÓ concede privilégios. NÃO cria o papel e NÃO altera a senha,
--  então a aplicação continua usando a mesma credencial do .env.
--
--  Rodar como postgres:
--    psql -U postgres -d hml_minas_farma -f 03_regrant_privileges.sql
--
--  DICA DE DURABILIDADE: para não precisar rodar isto toda vez, adicione estes
--  mesmos comandos ao FINAL da sua rotina de restore do banco de homologação.
-- =============================================================================

GRANT USAGE, CREATE ON SCHEMA public TO minasfarma_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO minasfarma_app;
GRANT USAGE, SELECT, UPDATE            ON ALL SEQUENCES IN SCHEMA public TO minasfarma_app;
GRANT REFERENCES, TRIGGER              ON ALL TABLES    IN SCHEMA public TO minasfarma_app;

-- Para tabelas/sequences que o postgres criar no futuro (novas migrações):
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO minasfarma_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE          ON SEQUENCES TO minasfarma_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT REFERENCES, TRIGGER            ON TABLES    TO minasfarma_app;

-- Verificação (deve retornar t, t):
SELECT has_table_privilege('minasfarma_app','users','SELECT') AS le_users,
       has_table_privilege('minasfarma_app','users','UPDATE') AS grava_users;
