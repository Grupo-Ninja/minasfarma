# CI/CD — Minas Farma

Pipeline em [`.github/workflows/deploy.yml`](workflows/deploy.yml).

## Como funciona
1. **Push na `main`** (ou "Run workflow" manual) dispara o pipeline.
2. **Job `ci`**: builda o frontend (`npm ci && npm run build`) e checa a sintaxe
   do backend. Se falhar, o deploy **não** acontece.
3. **Job `deploy`** (só se o `ci` passar): conecta por SSH no servidor e roda:
   ```bash
   cd $APP_DIR
   git fetch origin main && git reset --hard origin/main
   docker compose -f docker-compose.yml up -d --build
   docker image prune -f
   curl http://127.0.0.1:8321/health   # verifica se subiu
   ```
   > Usa **sempre** o `docker-compose.yml` (portas 5178 frontend / 8321 backend,
   > que batem com o nginx). Nunca o `docker-compose.prod.yml`.

## Configuração (uma vez)

### 1. Gerar uma chave de deploy (sem senha)
Em qualquer máquina:
```bash
ssh-keygen -t ed25519 -C "github-actions-minasfarma" -f minasfarma_deploy -N ""
```
Isso gera `minasfarma_deploy` (privada) e `minasfarma_deploy.pub` (pública).

### 2. Autorizar a chave pública no servidor
Para o usuário que fará o deploy (precisa ter acesso ao Docker e à pasta do app):
```bash
ssh USUARIO@SERVIDOR 'cat >> ~/.ssh/authorized_keys' < minasfarma_deploy.pub
```

### 3. Cadastrar os secrets no GitHub
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret     | Valor                                                    |
|------------|----------------------------------------------------------|
| `SSH_HOST` | IP ou host do servidor (acessível de fora)               |
| `SSH_USER` | usuário do deploy (ex.: `root` ou `ubuntu`)              |
| `SSH_PORT` | porta SSH (geralmente `22`)                              |
| `SSH_KEY`  | conteúdo da chave **privada** `minasfarma_deploy`        |
| `APP_DIR`  | caminho do repo no servidor (ex.: `/home/ubuntu/clientes/minas_farma`) |

### 4. Testar
Faça um push na `main` (ou use **Actions → CI/CD → Run workflow**) e acompanhe em
**Actions**. O deploy deve terminar com `OK` no healthcheck.

## Requisitos do usuário de deploy
- Ter permissão para rodar `docker` (ser `root` ou estar no grupo `docker`).
- Ter acesso de leitura/escrita à pasta `$APP_DIR` (o repo git).
- O `.env` de produção **não** é versionado — permanece intacto no servidor.

## Observações
- O servidor precisa ter a porta SSH acessível para os runners do GitHub. Se o SSH
  for restrito por firewall, libere os ranges de IP do GitHub Actions ou avalie um
  runner self-hosted.
- Lembrete de banco: se uma rotina de restore apagar os privilégios do usuário de
  aplicação, rode `db/03_regrant_privileges.sql` (ou coloque no fim do restore).
