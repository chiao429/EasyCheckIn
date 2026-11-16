# CI/CD secrets

部署服务器需要准备 `docker-compose.prod.yml` 与 `.env.production`，并在仓库 Settings → Secrets and variables → Actions 添加：

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `GHCR_TOKEN`（至少有 `read:packages` 权限）

服务器上的 compose 文件中，将 `IMAGE` 设置为仓库对应的 GHCR 镜像，例如：

```env
IMAGE=ghcr.io/your-org/easycheck:latest
```

## Vercel CI/CD

`.github/workflows/vercel.yml` 会在 Pull Request 部署 Preview，在 `main` 部署 Production。请在 GitHub → Settings → Secrets and variables → Actions 添加：

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

取得 ID 的方式：在本机运行 `vercel link`，然后读取 `.vercel/project.json` 中的 `orgId` 与 `projectId`。如果 Vercel 项目已经启用 Git Integration，请关闭自动部署，避免一次提交触发两次部署。
