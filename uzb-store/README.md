# UZB STORE

Public Uzbek app marketplace with protected owner admin panel.

## Run
`npm install && npm start`

## Render environment
`ADMIN_PASSWORD` (required), `NODE_ENV=production`.

Health endpoint: `/health`.

Note: this first version keeps catalog entries in server memory. They reset when the service restarts or redeploys; a persistent database is required for durable listings. Download URLs must point to files you are authorized to distribute.
