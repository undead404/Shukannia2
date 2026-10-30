import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { Linter } from 'eslint';
import { parser } from 'typescript-eslint';

import rule from './workspace-imports.mjs';

const linter = new Linter();
const root = resolve(import.meta.dirname, '..');
function lint(code, filename = 'apps/web/src/example.js') {
  return linter.verify(
    code,
    {
      languageOptions: { parser },
      plugins: { workspace: { rules: { imports: rule } } },
      rules: { 'workspace/imports': 'error' },
    },
    { filename: resolve(root, filename) },
  );
}

test('rejects imports across workspace directories', () => {
  for (const code of [
    "import '../../../packages/domain/src/index.js';",
    "export * from '../../../packages/domain/src/index.js';",
    "export { value } from '../../../packages/domain/src/index.js';",
    "import('../../../packages/domain/src/index.js');",
    "require('../../../packages/domain/src/index.js');",
    "import type { Title } from '../../../packages/domain/src/index.js';",
    "type Domain = import('../../../packages/domain/src/index.js');",
  ]) {
    assert.equal(lint(code)[0]?.messageId, 'package', code);
  }
  assert.equal(
    lint("import '../../domain/src/index.js';", 'packages/db/src/example.js')[0]
      ?.messageId,
    'package',
  );
});

test('rejects app imports by path and package name', () => {
  for (const specifier of [
    '../../local-api/src/server.js',
    '@shukannia/local-api',
    '@shukannia/web/src/App',
    'apps/local-api/src/server.js',
  ]) {
    assert.equal(lint(`import '${specifier}';`)[0]?.messageId, 'app');
  }
  assert.equal(
    lint("import '../apps/local-api/src/server.js';", 'tests/example.js')[0]
      ?.messageId,
    'app',
  );
});

test('allows package imports and relative imports within a workspace', () => {
  for (const specifier of [
    '@shukannia/domain',
    '@shukannia/ingest/demo',
    './utils.js',
    '../other.js',
  ])
    assert.deepEqual(lint(`import '${specifier}';`), []);
  assert.deepEqual(
    lint("import './server.js';", 'apps/local-api/src/example.js'),
    [],
  );
});
