const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const target = process.argv[2];
if (!target) throw new Error('Usage: node prepare-pages.cjs <gh-pages-worktree>');
const destination = fs.realpathSync(path.resolve(target));
const repositoryRoot = fs.realpathSync(execFileSync('git', ['-C', destination, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
if (destination !== repositoryRoot || destination === fs.realpathSync(__dirname)) {
  throw new Error('The destination must be a separate Git worktree root.');
}
if (!fs.existsSync(path.join(destination, '.nojekyll'))) {
  throw new Error('Expected the existing GitHub Pages checkout with .nojekyll.');
}
const source = path.join(__dirname, 'mobile', 'dist-app');
const entry = path.join(source, 'index.html');
if (!fs.existsSync(entry)) throw new Error('Run npm run export:web in mobile first.');
const html = fs.readFileSync(entry, 'utf8').replace('lang="en"', 'lang="zh-CN"').replace(/<title>.*?<\/title>/, '<title>天图 CRM · 销售工作台</title>');
fs.cpSync(source, path.join(destination, 'app'), { recursive: true });
fs.mkdirSync(path.join(destination, 'web'), { recursive: true });
for (const file of ['index.html', 'web/index.html', 'app/index.html']) {
  fs.writeFileSync(path.join(destination, file), html, 'utf8');
}
console.log('Prepared App assets and entry pages. Review git diff before pushing gh-pages.');
