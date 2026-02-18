const fs = require('fs');
const path = require('path');

const resourcesDir = path.join(__dirname, '..', 'resources');
const svgPath = path.join(resourcesDir, 'icon.svg');
const pngPath = path.join(resourcesDir, 'icon.png');

async function generateIcons() {
  // Skip if icons already exist
  if (fs.existsSync(pngPath)) {
    console.log('Icons already exist, skipping generation');
    return;
  }

  if (!fs.existsSync(svgPath)) {
    console.log('icon.svg not found, skipping icon generation');
    return;
  }

  // Try to load sharp - it may not be available on all platforms
  let sharp;
  try {
    sharp = require('sharp');
  } catch (err) {
    console.log('sharp not available, skipping icon generation');
    return;
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
  console.error('Error generating icons:', err.message);
  // Don't exit with error - icons may already exist
});
