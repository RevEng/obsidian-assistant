# Guidelines

These rules must be followed when developing the Obsidian plugin:

- All code is written in TypeScript v5.5.3
- All code is formatted with Prettier
- All code is linted with ESLint
- All code is tested with Jest
- The plugin should be compatible with Obsidian's latest version
- The plugin should handle errors gracefully and provide user feedback
- The plugin should be responsive and work well on different screen sizes
- The plugin should be accessible and follow best practices for accessibility
- The plugin should be performant and not block the main thread
- The plugin should be well-documented, including inline comments and a README file
- The plugin should be modular and follow best practices for code organization
- The plugin should be open source and follow the MIT license
- Do not add comments in the code that are not useful or do not provide additional context
- Do not include commented-out code in the codebase
- Do not use hard-coded paths unless specifically requested
- Use console.error for error logging and console.log for debugging information, in addition to user-facing error messages
- Only modify code directly related to the task at hand
- Maintain consistency with existing code style and structure where possible

After all changes to source code (.ts or .js files), the following commands should be run:

1. run `npm run format` to format the code
2. run `npm run lint` to lint the code
3. run `npm run test` to run tests
4. run `npm run build` to build the plugin
5. run `npm run package` to create a zip file for manual installation
