const fs = require('fs');

function unescape(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\\\${/g, '${').replace(/\\`/g, '`');
  fs.writeFileSync(file, content);
}

unescape('app/(dashboard)/dashboard/projects/ProjectsClient.tsx');
unescape('app/(dashboard)/dashboard/subscriptions/SubscriptionsClient.tsx');
unescape('app/(dashboard)/dashboard/chat/ChatClient.tsx');
unescape('app/(dashboard)/dashboard/invoices/InvoicesClient.tsx');
