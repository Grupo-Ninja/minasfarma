-- Permite recadastrar um login cujo usuÃ¡rio foi desativado (soft delete).
-- MantÃ©m a unicidade entre usuÃ¡rios ativos e preserva todo o histÃ³rico.
-- CompatÃ­vel com PostgreSQL e seguro para execuÃ§Ã£o repetida.

BEGIN;

-- Remove a restriÃ§Ã£o Ãºnica antiga criada por users.login UNIQUE.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_login_key;
DROP INDEX IF EXISTS users_login_key;

-- Falha explicitamente se jÃ¡ houver duplicidade entre usuÃ¡rios ativos.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM users
        WHERE active IS TRUE
        GROUP BY login
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Existem logins duplicados entre usuarios ativos; corrija-os antes da migracao';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_login_active
    ON users (login)
    WHERE active IS TRUE;

COMMIT;
