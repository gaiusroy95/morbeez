const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const WORKSPACE_PACKAGES = ['shared', 'ui-native'];

/**
 * Metro config for Morbeez Expo apps in the npm workspace monorepo.
 * @param {string} projectRoot - __dirname of the app folder
 */
function createMetroConfig(projectRoot) {
  const workspaceRoot = path.resolve(projectRoot, '../..');
  const config = getDefaultConfig(projectRoot);

  config.watchFolders = [workspaceRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];

  // Explicitly map workspace packages — npm hoists to root node_modules but
  // Metro still needs direct paths for file: dependencies in monorepos.
  config.resolver.extraNodeModules = WORKSPACE_PACKAGES.reduce((acc, pkg) => {
    acc[`@morbeez/${pkg}`] = path.resolve(workspaceRoot, 'packages', pkg);
    return acc;
  }, {});

  return config;
}

module.exports = { createMetroConfig };
