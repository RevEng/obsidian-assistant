// Script to install the plugin to the Obsidian plugins directory
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

try {
  // Get package information
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  const version = packageJson.version;
  const pluginsDir = packageJson.config.obsidianPluginsDir.replace(
    '%USERPROFILE%',
    process.env.USERPROFILE
  );

  // Construct the path to the zip file
  const zipFile = path.resolve(`./release/obsidian-assistant-${version}.zip`);

  // Check if the zip file exists
  if (fs.existsSync(zipFile)) {
    // Create the plugins directory if it doesn't exist
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    // Extract the zip file to the plugins directory
    const command = `powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${pluginsDir}' -Force"`;
    execSync(command);

    console.log(`Plugin installed successfully to ${pluginsDir}!`);
  } else {
    console.error('Error: Release zip file not found. Please run npm run package first.');
    process.exit(1);
  }
} catch (error) {
  console.error('Error installing plugin:', error.message);
  process.exit(1);
}
