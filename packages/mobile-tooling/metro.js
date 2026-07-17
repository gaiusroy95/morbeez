const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
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

  // Shared packages use NodeNext-style `.js` import specifiers that point at `.ts`
  // sources. Resolve those for Metro so Expo apps and backend typecheck stay aligned.
  const defaultResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (
      typeof moduleName === 'string' &&
      moduleName.startsWith('.') &&
      moduleName.endsWith('.js') &&
      typeof context.originModulePath === 'string' &&
      context.originModulePath.includes(`${path.sep}packages${path.sep}`)
    ) {
      const fromDir = path.dirname(context.originModulePath);
      const withoutJs = moduleName.slice(0, -3);
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const candidate = path.resolve(fromDir, withoutJs + ext);
        if (fs.existsSync(candidate)) {
          return { type: 'sourceFile', filePath: candidate };
        }
      }
    }

    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  return config;
}

module.exports = { createMetroConfig };
