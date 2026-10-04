/**
 * eslint-config-narwhal — turn off Unicorn rules whose autofix fights SonarJS.
 * Spread after unicorn + sonarjs recommended configs.
 */
export default {
	name: 'narwhal/sonar-over-unicorn',
	rules: {
		// Sonar (S7773 / prefer-number-properties) wants Number.NaN; Unicorn autofix rewrites to NaN
		'unicorn/prefer-global-number-constants': 'off',
	},
};
