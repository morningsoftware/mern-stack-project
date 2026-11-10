// PM2 always executes TypeScript through the installed tsx runtime.
module.exports = {
  apps: [{
    name: process.env.PM2_APP_NAME || 'mern-api',
    cwd: __dirname,
    script: './node_modules/tsx/dist/cli.mjs',
    args: 'src/index.ts',
    interpreter: 'node',
    env: {
      NODE_ENV: 'production',
      ...(process.env.CHECKPOINT_PUBLIC_URL
        ? { CHECKPOINT_PUBLIC_URL: process.env.CHECKPOINT_PUBLIC_URL }
        : {}),
    },
    kill_timeout: 5000,
  }],
};
