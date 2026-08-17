module.exports = {
  root: true,
  extends: 'airbnb-base',
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  // React/JSX is the Next.js rendering layer's domain (linted separately); don't let the
  // import plugin try to parse .jsx modules with the EDS (non-JSX) babel parser.
  settings: {
    'import/ignore': ['\\.jsx$'],
  },
  rules: {
    'import/extensions': ['error', { js: 'always', jsx: 'always' }], // require file extensions in imports
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
  },
  overrides: [
    {
      // Service worker: runs in ServiceWorkerGlobalScope, where `self` (not `window`) is the
      // correct global. Airbnb's no-restricted-globals flags `self` as a "confusing browser
      // global", but there's no window/self ambiguity in this scope.
      files: ['public/sw.js'],
      env: { serviceworker: true },
      rules: { 'no-restricted-globals': 'off' },
    },
  ],
};
