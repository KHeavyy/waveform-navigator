// ESLint flat config for ESLint v9+ to enforce `curly` across JS/TS files
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
	{
		// Ignore generated/build outputs and coverage artifacts
		ignores: [
			'dist/**',
			'build/**',
			'node_modules/**',
			'coverage/**',
			'demo/dist/**',
			'demo/build/**',
		],
	},
	{
		// Apply to source files only
		files: [
			'src/**/*.{js,jsx,ts,tsx}',
			'demo/src/**/*.{js,jsx,ts,tsx}',
			'test/**/*.{js,jsx,ts,tsx}',
			'e2e/**/*.{js,jsx,ts,tsx}',
		],
		languageOptions: {
			parser: require('@typescript-eslint/parser'),
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				// Intentionally omit `project` to avoid TSConfig include issues for mixed files
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
			prettier: prettierPlugin,
			'react-hooks': reactHooksPlugin,
		},
		rules: {
			// Require braces for all control statements
			curly: ['error', 'all'],
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			// Require a blank line after a block closing brace
			'padding-line-between-statements': [
				'error',
				{ blankLine: 'always', prev: 'block', next: '*' }
			],
			// Surface Prettier issues as ESLint errors
			'prettier/prettier': 'error',
		},
	},
];
