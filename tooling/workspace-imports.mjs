import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appNames = readdirSync(resolve(root, 'apps'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map(
    (entry) =>
      JSON.parse(
        readFileSync(resolve(root, 'apps', entry.name, 'package.json'), 'utf8'),
      ).name,
  );
const workspaceNames = new Set(['apps', 'packages']);

function workspace(file) {
  const [kind, name] = relative(root, file).split(sep);
  return workspaceNames.has(kind) && name ? `${kind}/${name}` : null;
}

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      package:
        'Import workspace packages by package name and declare a workspace:* dependency.',
      app: 'Apps cannot be imported from outside their own app. Move shared code into a workspace package.',
    },
  },
  create(context) {
    const filename = context.physicalFilename;
    const sourceWorkspace = workspace(filename);
    function check(node) {
      if (node?.type === 'TSLiteralType') node = node.literal;
      if (!node || typeof node.value !== 'string') return;
      const specifier = node.value;
      if (
        specifier === 'apps' ||
        specifier.startsWith('apps/') ||
        appNames.some(
          (name) => specifier === name || specifier.startsWith(`${name}/`),
        )
      ) {
        context.report({ node, messageId: 'app' });
        return;
      }
      if (specifier.startsWith('packages/')) {
        context.report({ node, messageId: 'package' });
        return;
      }
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) return;
      const target = resolve(filename, '..', specifier);
      const targetWorkspace = workspace(target);
      if (!targetWorkspace || targetWorkspace === sourceWorkspace) return;
      context.report({
        node,
        messageId: targetWorkspace.startsWith('apps/') ? 'app' : 'package',
      });
    }
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require')
          check(node.arguments[0]);
      },
      TSImportType: (node) => check(node.argument),
    };
  },
};
