const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.next')) {
      results = results.concat(walk(file));
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
      results.push(file);
    }
  });
  return results;
}
const files = walk('.');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('"PUBLISHED"')) {
    content = content.replace(/"PUBLISHED"/g, '"AVAILABLE"');
    fs.writeFileSync(file, content);
    console.log('Updated string ' + file);
  }
});
