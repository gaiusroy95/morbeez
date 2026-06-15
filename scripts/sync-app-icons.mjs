#!/usr/bin/env node
/**
 * Convert brand/app-icons/{app} masters into apps/{app}/assets/app-icon.png (1024×1024 PNG).
 * Used locally and on EAS via eas-build-pre-install.
 */
import { access, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'brand', 'app-icons');
const APPS = ['farmer', 'warehouse', 'agronomist', 'telecaller', 'partner'];
const SIZE = 1024;
const EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp'];

async function resolveSource(app) {
  for (const ext of EXTENSIONS) {
    const candidate = path.join(ICONS_DIR, `${app}${ext}`);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next extension
    }
  }
  return null;
}

async function main() {
  try {
    await access(ICONS_DIR);
  } catch {
    console.error('Missing icon directory: brand/app-icons/');
    console.error('Add source files: brand/app-icons/farmer.jpeg, warehouse.jpeg, agronomist.jpeg, telecaller.jpeg');
    process.exit(1);
  }

  const available = await readdir(ICONS_DIR);
  console.log(`Sources in brand/app-icons/: ${available.join(', ')}`);

  for (const app of APPS) {
    const source = await resolveSource(app);
    if (!source) {
      console.error(`Missing source for ${app} (expected brand/app-icons/${app}.jpeg or .png)`);
      process.exit(1);
    }

    const destDir = path.join(ROOT, 'apps', app, 'assets');
    await mkdir(destDir, { recursive: true });
    const dest = path.join(destDir, 'app-icon.png');

    await sharp(source)
      .resize(SIZE, SIZE, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toFile(dest);

    console.log(`Wrote ${path.relative(ROOT, dest)} ← ${path.relative(ROOT, source)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
