// Patches skinview3d to enable WebGL alpha channel for transparent canvas background
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'node_modules', 'skinview3d', 'libs', 'viewer.js');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('alpha: true')) {
  content = content.replace(
    'preserveDrawingBuffer: options.preserveDrawingBuffer === true, // default: false\n        });',
    'preserveDrawingBuffer: options.preserveDrawingBuffer === true, // default: false\n            alpha: true,\n        });'
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Patched skinview3d: enabled alpha channel');
} else {
  console.log('skinview3d already patched');
}
