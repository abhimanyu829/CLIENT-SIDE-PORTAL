const fs = require('fs');

function fixNavbar() {
  const path = 'components/layout/Navbar.tsx';
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/bg-\[#050505\]\/90/g, 'bg-background/90');
  content = content.replace(/bg-\[#080808\]\/95/g, 'bg-popover/95');
  content = content.replace(/bg-\[#040404\]\/98/g, 'bg-background/98');
  content = content.replace(/shadow-black\/30/g, 'shadow-sm');
  content = content.replace(/border-white\/\[0\.06\]/g, 'border-border');
  content = content.replace(/border-white\/10/g, 'border-border');
  content = content.replace(/text-white/g, 'text-foreground');
  content = content.replace(/bg-white\/5/g, 'bg-muted');
  fs.writeFileSync(path, content);
}

function fixFooter() {
  const path = 'components/layout/Footer.tsx';
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/rgba\(4,4,4,\.97\)/g, 'hsl(var(--background))');
  content = content.replace(/rgba\(255,255,255,\.05\)/g, 'hsl(var(--border))');
  content = content.replace(/rgba\(255,255,255,\.38\)/g, 'hsl(var(--muted-foreground))');
  content = content.replace(/rgba\(255,255,255,\.85\)/g, 'hsl(var(--foreground))');
  content = content.replace(/rgba\(255,255,255,\.03\)/g, 'hsl(var(--muted))');
  content = content.replace(/rgba\(255,255,255,\.07\)/g, 'hsl(var(--border))');
  content = content.replace(/rgba\(255,255,255,\.45\)/g, 'hsl(var(--muted-foreground))');
  content = content.replace(/rgba\(255,255,255,\.15\)/g, 'hsl(var(--foreground))');
  content = content.replace(/rgba\(255,255,255,\.75\)/g, 'hsl(var(--foreground))');
  content = content.replace(/rgba\(255,255,255,\.08\)/g, 'hsl(var(--border))');
  content = content.replace(/rgba\(255,255,255,\.02\)/g, 'hsl(var(--card))');
  content = content.replace(/rgba\(255,255,255,\.06\)/g, 'hsl(var(--border))');
  content = content.replace(/rgba\(255,255,255,\.1\)/g, 'hsl(var(--border))');
  content = content.replace(/rgba\(255,255,255,\.25\)/g, 'hsl(var(--muted-foreground))');
  content = content.replace(/#fff/g, 'hsl(var(--foreground))');
  content = content.replace(/text-white/g, 'text-foreground');
  content = content.replace(/border-white\/5/g, 'border-border');
  
  // Re-fix the subscribe button text to ensure it remains white, as it has a colorful background
  content = content.replace(/from-purple-600 to-indigo-600 text-foreground/g, 'from-purple-600 to-indigo-600 text-white');
  
  fs.writeFileSync(path, content);
}

fixNavbar();
fixFooter();
