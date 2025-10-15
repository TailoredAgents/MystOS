# Deploying to Render

1. Commit `render.yaml` and push to the branch used for deployment.
2. In Render, choose **Blueprints ? New Blueprint** and point it at the MystOS repository/branch.
3. Render will provision:
   - Postgres `mystos-db` (Standard, Virginia)
   - Web services `myst-site` and `myst-api`
   - Redis `myst-redis`
4. Set environment variables before the first deploy:
   - Shared: `NODE_ENV=production`, `NODE_VERSION=20`
   - Site: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`
   - API: `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`
   - `DATABASE_URL` is wired automatically from `mystos-db`
5. Deploy the blueprint. `myst-api` runs `pnpm -w db:migrate` on each deploy.
6. Wait for `/healthz` on both services to return `200 ok`.
7. Submit a live lead on the deployed site and confirm records in `contacts`, `properties`, `leads`, and `outbox_events`.
8. Connect your custom domain to `myst-site` via Render DNS.