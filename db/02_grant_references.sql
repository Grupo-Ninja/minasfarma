-- =============================================================================
--  Minas Farma - Complemento de privilégios para minasfarma_app
-- =============================================================================
--  Necessário porque as tabelas novas da aplicação (employee_schedules) têm
--  CHAVE ESTRANGEIRA para a tabela 'users' (que pertence ao postgres). Criar
--  esse FK exige o privilégio REFERENCES na tabela referenciada.
--
--  Continua 100% ADITIVO e seguro: não é superusuário, não pode dropar o banco,
--  não revoga nada de ninguém.
--
--  Rodar como postgres:
--    psql -U postgres -d hml_minas_farma -f 02_grant_references.sql
-- =============================================================================

GRANT REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO minasfarma_app;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT REFERENCES, TRIGGER ON TABLES TO minasfarma_app;
