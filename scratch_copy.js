import fs from 'fs';
import path from 'path';

const srcDir = 'C:\\Users\\lteli\\.gemini\\antigravity-ide\\brain\\5edd4448-4a3c-4f74-bebc-f953468f3bbb';
const destDir = 'c:\\Users\\lteli\\.gemini\\antigravity-ide\\scratch\\Fallstudie_Software_Engineering_Med-Pre-Check-In\\public\\logos';

// Make sure destination exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const mappings = {
  'logo_general_1780345483693.png': 'logo_general.png',
  'logo_dermatology_1780345499429.png': 'logo_dermatology.png',
  'logo_dental_1780345511976.png': 'logo_dental.png',
  'logo_pediatrics_1780345527226.png': 'logo_pediatrics.png',
  'logo_cardio_1780345539184.png': 'logo_cardio.png'
};

for (const [srcFile, destFile] of Object.entries(mappings)) {
  const srcPath = path.join(srcDir, srcFile);
  const destPath = path.join(destDir, destFile);
  
  if (fs.existsSync(srcPath)) {
    try {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied ${srcFile} to ${destFile} successfully.`);
    } catch (err) {
      console.error(`Failed to copy ${srcFile}:`, err);
    }
  } else {
    console.error(`Source file not found: ${srcPath}`);
  }
}
