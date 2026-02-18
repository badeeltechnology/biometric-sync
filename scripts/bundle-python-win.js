/**
 * Script to download and bundle Python for Windows builds.
 * Downloads Python embeddable package and installs required dependencies.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PYTHON_VERSION = '3.11.9';
const PYTHON_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
const BUNDLE_DIR = path.join(__dirname, '..', 'python-bundle-win');
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function extractZip(zipPath, destDir) {
  // Use PowerShell to extract on Windows, unzip on Unix
  if (process.platform === 'win32') {
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {
      stdio: 'inherit'
    });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
  }
}

async function main() {
  console.log('=== Bundling Python for Windows ===\n');

  // Create bundle directory
  if (fs.existsSync(BUNDLE_DIR)) {
    console.log('Cleaning existing bundle directory...');
    fs.rmSync(BUNDLE_DIR, { recursive: true });
  }
  fs.mkdirSync(BUNDLE_DIR, { recursive: true });

  const zipPath = path.join(BUNDLE_DIR, 'python.zip');
  const pythonDir = path.join(BUNDLE_DIR, 'python');

  // Download Python embeddable package
  await download(PYTHON_URL, zipPath);
  console.log('Python downloaded successfully.\n');

  // Extract Python
  console.log('Extracting Python...');
  fs.mkdirSync(pythonDir, { recursive: true });
  await extractZip(zipPath, pythonDir);
  console.log('Python extracted.\n');

  // Enable site-packages by modifying python311._pth
  const pthFile = path.join(pythonDir, `python311._pth`);
  if (fs.existsSync(pthFile)) {
    console.log('Enabling site-packages...');
    let pthContent = fs.readFileSync(pthFile, 'utf8');
    // Uncomment import site
    pthContent = pthContent.replace('#import site', 'import site');
    // Add Lib/site-packages
    pthContent += '\nLib/site-packages\n';
    fs.writeFileSync(pthFile, pthContent);
  }

  // Download get-pip.py
  const getPipPath = path.join(pythonDir, 'get-pip.py');
  await download(GET_PIP_URL, getPipPath);
  console.log('get-pip.py downloaded.\n');

  // Note: pip installation and package installation should be done on Windows
  // or we need to use a different approach
  console.log('=== Python bundle prepared ===');
  console.log(`\nBundle location: ${pythonDir}`);
  console.log('\nTo complete setup on Windows, run:');
  console.log('  cd python-bundle-win/python');
  console.log('  python.exe get-pip.py');
  console.log('  python.exe -m pip install pyzk requests openpyxl reportlab schedule');
  console.log('\nThen copy the python folder to your build resources.');

  // Clean up zip file
  fs.unlinkSync(zipPath);

  // Create a batch file for Windows setup
  const batchContent = `@echo off
echo Installing pip...
python.exe get-pip.py
echo.
echo Installing dependencies...
python.exe -m pip install pyzk requests openpyxl reportlab schedule --target Lib/site-packages
echo.
echo Done! Python is ready for bundling.
pause
`;
  fs.writeFileSync(path.join(pythonDir, 'setup-deps.bat'), batchContent);
  console.log('\nCreated setup-deps.bat for Windows dependency installation.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
