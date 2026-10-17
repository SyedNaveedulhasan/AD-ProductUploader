# Deploy AD Uploader to Vercel

## Project settings

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Node.js version | 24.x |
| Root directory | Folder containing package.json |
| Install command | npm ci |
| Build command | npm run build |
| Output directory | Leave automatic; Vercel uses .next |

The repository's vercel.json supplies the framework and build settings. The build uses native Next.js, not the optional Sites adapter. Do not set NEXT_BUILD_DIR in Vercel.

## Environment variables

In Vercel Project Settings → Environment Variables, add these for Production. Add them for Preview only if previews should use the same database and store records.

| Name | Value |
| --- | --- |
| SUPABASE_URL | Your existing Supabase project URL |
| SUPABASE_ANON_KEY | Your existing Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | Your existing server-only service-role key |
| CREDENTIAL_ENCRYPTION_KEY | The exact encryption key from your local .env.local |

SITES_USE_IDENTITY=false is set in vercel.json. WOO_ALLOWED_HOSTS is no longer used. Do not add NEXT_PUBLIC_ prefixes to the server keys. Never commit or upload .env.local. Using the same Supabase project preserves accounts, drafts, and store connections. Using the exact same encryption key is essential to decrypt the saved WooCommerce keys.

## Deploy from GitHub

1. Push this folder to your own GitHub repository. The ignore files exclude local secrets, dependencies, and generated builds. Include package-lock.json and vercel.json.
2. In Vercel, choose Add New → Project and import that repository.
3. Confirm the settings above and add the environment variables before deploying.
4. Select Deploy. Future pushes to the production branch trigger deployments.

## Deploy directly from this folder

GitHub is optional. In PowerShell, from the project folder:

```powershell
npx.cmd vercel@latest login
npx.cmd vercel@latest --prod
```

Select your account/team, create or link the intended project, and use the current directory. If deploying first without environment variables, the app will show Setup required. Add the variables in Vercel, then run the production deployment command again. The .vercelignore file excludes .env.local from CLI uploads; add secrets through Vercel's settings instead.

## Supabase after deployment

In Supabase Authentication → URL Configuration, set Site URL to the production HTTPS domain. Add that same domain as an allowed redirect URL for authentication flows. Keep localhost as an additional redirect URL if you still develop locally. Add preview domains only if you intend to enable account flows on those previews.

## Verify the deployed app

1. Open the production URL and confirm it does not show Setup required.
2. Sign in with an existing account. Your browser's local sign-in session does not transfer between localhost and the production domain.
3. Confirm your saved stores and products load.
4. Create a draft, then upload it to a test store and confirm the result in WooCommerce.
5. Test an image under 4 MB and check Vercel logs if a request fails. Error references identify handled server failures without logging credentials.

## Hosting limits

Product publishing is configured for a maximum of 300 seconds per request. Enable Fluid compute for an existing project if needed. Large variation sets can still exceed this limit; bulk uploads run one product at a time with the browser kept open. Image uploads are capped at 4 MB to stay below Vercel's 4.5 MB multipart payload limit. Larger files can be hosted separately and entered as public HTTPS image URLs.

References: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [function limits](https://vercel.com/docs/functions/limitations), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
