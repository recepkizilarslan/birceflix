const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('backend/src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  const replacements = [
    { from: /rlRead, async/g, to: "{ config: rlRead.config }, async" },
    { from: /rlWrite, async/g, to: "{ config: rlWrite.config }, async" },
    { from: /rlAuth, async/g, to: "{ config: rlAuth.config }, async" },
    { from: /rlWebhook, async/g, to: "{ config: rlWebhook.config }, async" }
  ];
  
  replacements.forEach(r => {
    if (r.from.test(content)) {
      content = content.replace(r.from, r.to);
      changed = true;
    }
  });
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
});
