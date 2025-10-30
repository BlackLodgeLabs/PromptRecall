#!/usr/bin/env node
/**
 * build-release.js
 * Create a release ZIP for the Chrome extension.
 * Usage: node build-release.js --out=prompt-recall-v1.0.2.zip --version=1.0.2
 */

const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

const outName = argv.out || argv.o || 'prompt-recall-release.zip';
const root = process.cwd();
const staging = path.join(root, 'build_staging');

(async () => {
  try {
    const pkg = await fs.readJson(path.join(root, 'package.json'));
    const version = pkg.version;

    await fs.remove(staging);
    await fs.ensureDir(staging);

    const includes = [
      'manifest.json',
      'README.md',
      'LICENSE',
      'config.js',
      'background',
      'content',
      'popup',
      'options',
      'utils',
      'assets',
      '_locales'
    ];

    for (const p of includes) {
      const src = path.join(root, p);
      if (await fs.pathExists(src)) {
        await fs.copy(src, path.join(staging, p));
        console.log('Copied', p);
      } else {
        console.log('Skipped (missing)', p);
      }
    }

    // Remove dev-only folders if accidentally copied
    const devRemove = ['.git', '.github', 'node_modules', 'tests', '__tests__'];
    for (const r of devRemove) {
      const target = path.join(staging, r);
      if (await fs.pathExists(target)) {
        await fs.remove(target);
      }
    }

    // Optionally update manifest version in the staged copy
    if (version) {
      const mf = path.join(staging, 'manifest.json');
      if (await fs.pathExists(mf)) {
        const m = await fs.readJson(mf);
        m.version = version.replace(/^v/, '');
        await fs.writeJson(mf, m, { spaces: 2 });
        console.log('Updated manifest version to', m.version);
      }
    }

    const outPath = path.join(root, outName);
    if (await fs.pathExists(outPath)) await fs.remove(outPath);

    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`${archive.pointer()} total bytes`);
      console.log('Archive created at:', outPath);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') console.warn(err);
      else throw err;
    });

    archive.on('error', (err) => { throw err; });

    archive.pipe(output);
    archive.directory(staging + '/', false);
    await archive.finalize();

    // cleanup
    await fs.remove(staging);
    console.log('Done. Staging cleaned up.');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
})();
