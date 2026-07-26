/** PM2 process config — used in production on your server */
module.exports = {
  apps: [
    {
      name:         "market-pulse-api",
      script:       "./artifacts/api-server/dist/index.mjs",
      instances:    1,
      exec_mode:    "fork",
      watch:        false,
      autorestart:  true,
      max_restarts: 10,
      restart_delay: 3000,
      // Loads DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, etc.
      // from a .env file next to this config (copy .env.example -> .env
      // and fill in real values; .env is gitignored, never commit it).
      env_file: "./.env",
      env: {
        NODE_ENV: "production",
        PORT:     "3001",
      },
    },
  ],
};
