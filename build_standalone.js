const fs = require('fs');
const path = require('path');
const vm = require('vm');

const globalRoot = 'C:/Users/Dell/AppData/Roaming/npm/node_modules';
const babel = require(path.join(globalRoot, '@babel/core'));
const presetReact = require(path.join(globalRoot, '@babel/preset-react'));

const srcPath = 'C:/Users/Dell/Desktop/AI/GenAI-Learning-Hub/standalone/genai_learning_hub.html';
let html = fs.readFileSync(srcPath, 'utf8');

const tag = '<script type="text/babel">';
const start = html.indexOf(tag);
const end = html.lastIndexOf('</script>');

if (start === -1 || end === -1) {
  console.error('Could not locate babel script tags in source HTML.');
  process.exit(1);
}

const jsx = html.substring(start + tag.length, end);
console.log('Transforming JSX with length:', jsx.length);

const res = babel.transformSync(jsx, {
  presets: [
    [presetReact, { runtime: 'classic' }]
  ],
  compact: false
});

console.log('Transformed JS length:', res.code.length);

// Verify with vm.Script
try {
  new vm.Script(res.code);
  console.log('Verification passed: Transformed JS is 100% valid syntax.');
} catch (err) {
  console.error('Verification failed:', err);
  process.exit(1);
}

// Remove babel-standalone CDN tag
let before = html.substring(0, start);
before = before.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+"><\/script>\s*/g, '');

const after = html.substring(end + '</script>'.length);

const finalHtml = before + `<script>\n${res.code}\n</script>` + after;

const destinations = [
  'standalone/genai_learning_hub.html',
  'genai_learning_hub.html',
  'frontend/public/standalone.html',
  'frontend/public/index.html'
];

for (const dest of destinations) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, finalHtml, 'utf8');
  console.log('Wrote verified standalone HTML to:', dest);
}

console.log('All files built and verified successfully!');
