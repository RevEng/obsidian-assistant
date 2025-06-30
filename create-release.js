const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Ensure the build is up-to-date
console.log('Building the plugin...');
execSync('npm run build', { stdio: 'inherit' });

// Files to include in the release
const filesToInclude = ['main.js', 'manifest.json', 'styles.css'];

// Create a release directory if it doesn't exist
const releaseDir = path.join(__dirname, 'release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir);
}

// Get the plugin name and version from manifest.json
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const pluginName = manifest.id;
const pluginVersion = manifest.version;
const zipFileName = `${pluginName}-${pluginVersion}.zip`;
const zipFilePath = path.join(releaseDir, zipFileName);

// Create a temporary directory for the files to zip
const tempDir = path.join(releaseDir, 'temp');
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir);

// Copy the files to the temporary directory
console.log('Copying files for the release...');
filesToInclude.forEach((file) => {
  const sourcePath = path.join(__dirname, file);
  const destPath = path.join(tempDir, file);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file}`);
  } else {
    console.error(`Error: ${file} not found`);
    process.exit(1);
  }
});

// Create the zip file using the system's zip command
console.log(`Creating ${zipFileName}...`);
try {
  // For Windows, use PowerShell's Compress-Archive
  if (process.platform === 'win32') {
    const powershellCommand = `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipFilePath}' -Force"`;
    execSync(powershellCommand);
  } else {
    // For Unix-like systems, use zip command
    execSync(`cd "${tempDir}" && zip -r "${zipFilePath}" ./*`);
  }
  console.log(`Successfully created ${zipFilePath}`);
} catch (error) {
  console.error('Error creating zip file:', error);
  process.exit(1);
}

// Clean up the temporary directory
fs.rmSync(tempDir, { recursive: true, force: true });

console.log('Release process completed successfully!');
