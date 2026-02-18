const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const resourcesDir = path.join(__dirname, '..', 'resources');
const svgPath = path.join(resourcesDir, 'icon.svg');
const pngPath = path.join(resourcesDir, 'icon.png');

async function generateIcons() {
  if (!fs.existsSync(svgPath)) {
    console.error('icon.svg not found in resources folder');
    process.exit(1);
  }

  const svg = fs.readFileSync(svgPath);

  // Create 512x512 PNG (works for all platforms)
  await sharp(svg)
    .resize(512, 512)
    .png()
    .toFile(pngPath);

  console.log('Generated icon.png (512x512)');

  // Create multiple sizes for better quality
  const sizes = [16, 32, 48, 64, 128, 256];
  for (const size of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(resourcesDir, `icon_${size}.png`));
  }

  console.log('Generated icon sizes:', sizes.join(', '));
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
