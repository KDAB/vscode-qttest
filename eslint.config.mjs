import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["out/**", "dist/**", "**/*.d.ts", ".vscode-test/**", "test/**/build*/**", "node_modules/**"]
    },
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 6,
                sourceType: "module"
            }
        },
        plugins: {
            "@typescript-eslint": tseslint.plugin
        },
        rules: {
            "@typescript-eslint/naming-convention": "off",
            "curly": "warn",
            "eqeqeq": "warn",
            "no-throw-literal": "warn",
            "semi": "warn"
        }
    }
);
