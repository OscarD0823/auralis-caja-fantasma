import { readFile, writeFile, mkdir, open, readdir } from 'node:fs/promises';
import { resolve, sep, basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const [mode = 'assemble', directory = '.', sourceDirectory = 'source'] = process.argv.slice(2);
const root = resolve(directory), source = resolve(sourceDirectory), output = join(root, 'assembled');
const json = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
const plan = await json(join(root, 'release-plan.json'));
const identity = await json(join(source, 'release/signing-identity.json'));
const packageInfo = await json(join(source, 'package.json'));
assert.equal(plan.version, packageInfo.version);
assert.equal(plan.version, '1.25.0');
assert.match(plan.sourceCommit, /^[a-f0-9]{40}$/);
const expected = [`Caja-Fantasma-${plan.version}-Instalador.exe`, `Caja-Fantasma-${plan.version}-Instalador.exe.sig`, `Caja-Fantasma-Android-${plan.version}.apk`, 'latest-v2.json', 'latest.json', 'SHA256SUMS.txt', `NOTAS-VERSION-${plan.version}.md`];
assert.deepEqual(plan.artifacts.map(file => file.name).sort(), [...expected].sort());
const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8', env: process.env });
  if (result.error || result.status !== 0) throw new Error(`${basename(command)} failed: ${result.stderr || result.error?.message || result.stdout}`);
  return result.stdout;
};
if (mode === 'assemble') {
  await mkdir(output, { recursive: true });
  for (const file of plan.artifacts) {
    assert.equal(file.name, basename(file.name));
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert(file.parts.length > 0);
    const hash = createHash('sha256'); let size = 0;
    const target = await open(join(output, file.name), 'wx');
    try {
      for (const part of file.parts) {
        const path = resolve(root, part);
        assert(path.startsWith(root + sep) && part.startsWith('payload/'), 'Invalid part location.');
        const bytes = await readFile(path);
        assert(bytes.length <= 1_048_576);
        hash.update(bytes); size += bytes.length;
        await target.writeFile(bytes);
      }
    } finally { await target.close(); }
    assert.equal(size, file.size, `${file.name}: size mismatch`);
    assert.equal(hash.digest('hex'), file.sha256, `${file.name}: SHA-256 mismatch`);
  }
  const current = await json(join(output, 'latest-v2.json'));
  const previous = await json(join(output, 'latest.json'));
  const legacy = await json(join(source, 'release/legacy-1.23.1.json'));
  assert.equal(current.version, plan.version);
  assert.equal(current.signing_generation, 2);
  assert.equal(current.platforms['windows-x86_64'].signature, (await readFile(join(output, expected[1]), 'utf8')).trim());
  assert.equal(previous.version, legacy.version);
  assert.deepEqual(previous.platforms, legacy.platforms);
  assert.deepEqual(previous.android, legacy.android);
  assert.equal(current.android.application_id, identity.androidApplicationId);
  assert.equal(current.android.certificate_sha256, identity.androidCertificateSha256);
  const apk = plan.artifacts.find(file => file.name === expected[2]);
  assert.equal(current.android.sha256.toLowerCase(), apk.sha256);
  const toolsRoot = join(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT, 'build-tools');
  const versions = (await readdir(toolsRoot)).filter(name => /^\d/.test(name)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const tools = join(toolsRoot, versions[0]);
  const verification = run(join(tools, 'apksigner'), ['verify', '--print-certs', join(output, apk.name)]);
  const certificates = [...verification.matchAll(/certificate SHA-256 digest: ([a-f0-9]+)/gi)].map(match => match[1].toLowerCase());
  assert.deepEqual(certificates, [identity.androidCertificateSha256]);
  const badging = run(join(tools, 'aapt2'), ['dump', 'badging', join(output, apk.name)]);
  const info = badging.match(/package: name='([^']+)'[^\r\n]*versionName='([^']+)'/);
  assert.equal(info?.[1], identity.androidApplicationId);
  assert.equal(info?.[2], plan.version);
  assert.match(badging, /native-code:.*'arm64-v8a'/);
  await writeFile(join(output, 'windows.pub'), identity.windowsPublicKey);
  console.log(`Paquetes reconstruidos y comprobados: ${plan.version}; Android ${identity.androidApplicationId}; canal anterior ${previous.version}.`);
} else if (mode === 'publish') {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.GITHUB_REPOSITORY, 'OscarD0823/auralis-caja-fantasma');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/release/prepared-1.25.0');
  const tag = `v${plan.version}`, repo = 'OscarD0823/auralis-caja-fantasma';
  const result = spawnSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'isDraft,targetCommitish'], { encoding: 'utf8' });
  const assets = expected.map(name => join(output, name));
  if (result.status === 0) {
    const existing = JSON.parse(result.stdout);
    assert(existing.isDraft && existing.targetCommitish === plan.sourceCommit, 'A different or already public release exists.');
    run('gh', ['release', 'upload', tag, ...assets, '--repo', repo, '--clobber']);
  } else {
    run('gh', ['release', 'create', tag, ...assets, '--repo', repo, '--target', plan.sourceCommit, '--title', `Caja Fantasma ${plan.version}`, '--notes-file', join(output, `NOTAS-VERSION-${plan.version}.md`), '--draft']);
  }
  const release = JSON.parse(run('gh', ['api', `repos/${repo}/releases?per_page=100`])).find(release => release.tag_name === tag);
  assert(release?.draft);
  for (const file of plan.artifacts) {
    const asset = release.assets.find(asset => asset.name === file.name);
    assert(asset && asset.size === file.size, `Missing uploaded asset ${file.name}`);
    if (asset.digest) assert.equal(asset.digest, `sha256:${file.sha256}`);
  }
  run('gh', ['release', 'edit', tag, '--repo', repo, '--draft=false', '--latest']);
  console.log(`Publicado: https://github.com/${repo}/releases/tag/${tag}`);
} else throw new Error('Unknown publication mode.');
