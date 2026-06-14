import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'
import vitest from '@vitest/eslint-plugin'

export default [
	// vitest.config.ts isn't part of the build tsconfig, so skip type-aware linting of it
	{
		ignores: ['vitest.config.ts'],
	},
	...(await generateEslintConfig({
		enableTypescript: true,
	})),
	{
		files: ['**/*.test.ts', 'src/__tests__/**/*'],
		plugins: { vitest },
		rules: {
			...vitest.configs.recommended.rules,
			// Test files may import devDependencies (vitest)
			'n/no-unpublished-import': 'off',
		},
	},
]
