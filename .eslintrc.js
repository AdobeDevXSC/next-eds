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
};
