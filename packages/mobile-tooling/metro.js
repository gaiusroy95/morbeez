const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/**
 * Metro config for Morbeez Expo apps in the monorepo.
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
  config.resolver.disableHierarchicalLookup = true;
  return config;
}

module.exports = { createMetroConfig };
