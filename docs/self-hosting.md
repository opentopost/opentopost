# Self-hosting

A self-hosted copy is free. Every feature is on, there is no billing, and you bring your own model key.

## Run it locally

1. Clone the repository and install the packages.

   ```bash
   git clone https://github.com/opentopost/opentopost.git
   cd opentopost
   ```

   ```bash
   npm install
   ```

2. Start Convex. The first run asks you to sign in and create a project. It writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Keep this terminal open.

   ```bash
   npx convex dev
   ```

3. Create a Kinde application of type "Back-end web". Add these URLs in the application settings:

   - Allowed callback URL: `http://localhost:3000/api/auth/kinde_callback`
   - Allowed logout redirect URL: `http://localhost:3000`

4. Copy the Kinde values from `.env.example` into `.env.local` and fill them in.

5. Set three values on the Convex deployment.

   ```bash
   npx convex env set KINDE_ISSUER_URL https://<your-subdomain>.kinde.com
   npx convex env set KINDE_CLIENT_ID <client id>
   npx convex env set SECRETS_MASTER_KEY "$(openssl rand -base64 32)"
   ```

6. Start the app in a second terminal.

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`, create an account, and add a model key.

## How keys are stored

A Convex action checks each key with the provider, then encrypts it with AES-256-GCM. The master key is the `SECRETS_MASTER_KEY` value on the Convex deployment. No query returns a key. The app shows the provider name and the last four characters only.
