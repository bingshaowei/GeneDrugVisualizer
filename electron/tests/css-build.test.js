const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..', '..');
const frontendRequire = createRequire(path.join(projectRoot, 'frontend', 'package.json'));
const postcss = frontendRequire('postcss');
const tailwind = frontendRequire('@tailwindcss/postcss');

test('样式构建保留应用布局类并排除未注册目录中的候选类', async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'gene-css-scan-'));
  // 保留临时夹具，避免自动删除文件。
  fs.writeFileSync(path.join(fixture, 'unrelated.js'), 'const unrelated = "w-[913px]";');
  const entry = path.join(projectRoot, 'frontend', 'src', 'index.css');
  const result = await postcss([tailwind({ base: fixture })]).process(fs.readFileSync(entry, 'utf8'), { from: entry });
  assert.match(result.css, /\.flex\s*\{/);
  assert.match(result.css, /\.grid\s*\{/);
  assert.match(result.css, /\.bg-white\s*\{/);
  assert.doesNotMatch(result.css, /width:\s*913px/);
});
