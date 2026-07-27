// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');

// Get the current branch name
const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

// Determine the environment and app name based on the branch
const isProduction = branch === 'main';
const appName = isProduction ? 'lsbbe_prod' : 'lsbbe_dev';
const nodeEnv = isProduction ? 'production' : 'development';

module.exports = {
  apps: [
    {
      name: appName, // Dynamically set the app name based on the branch
      script: './dist/main.js', // Path to your compiled application
      env: {
        NODE_ENV: nodeEnv, // Dynamically set the environment
      },
    },
  ],
};
