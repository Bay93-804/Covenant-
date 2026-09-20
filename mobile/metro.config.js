const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
// The repository root, one level up, holds the authoritative Phase 1
// program-content JSON at data/program/*.json. We watch it (rather than
// copying/re-deriving the file into this project) so the mobile app always
// imports the single source of truth directly.
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

module.exports = withNativeWind(config, { input: './global.css' });
