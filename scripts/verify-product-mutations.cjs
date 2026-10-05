#!/usr/bin/env node
/**
 * Verification script for product mutation capabilities
 * Checks that all new adapters and capabilities are properly registered
 * 
 * Usage: node scripts/verify-product-mutations.cjs
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function checkFileExists(filePath) {
  const exists = fs.existsSync(filePath);
  const fileName = path.basename(filePath);
  if (exists) {
    log(`  ✓ ${fileName}`, COLORS.green);
  } else {
    log(`  ✗ ${fileName} - NOT FOUND`, COLORS.red);
  }
  return exists;
}

function checkFileContains(filePath, searchString, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const found = content.includes(searchString);
    if (found) {
      log(`  ✓ ${description}`, COLORS.green);
    } else {
      log(`  ✗ ${description} - NOT FOUND`, COLORS.red);
    }
    return found;
  } catch (error) {
    log(`  ✗ ${description} - ERROR: ${error.message}`, COLORS.red);
    return false;
  }
}

log('\n═══════════════════════════════════════════════════════════════', COLORS.blue);
log('Product Mutation Capabilities - Verification', COLORS.blue);
log('═══════════════════════════════════════════════════════════════\n', COLORS.blue);

let totalChecks = 0;
let passedChecks = 0;

// Check 1: Adapter files exist
log('1. Checking adapter files...', COLORS.blue);
const adapterFiles = [
  'lib/agent-gateway/execution/adapters/products-create-draft-adapter.ts',
  'lib/agent-gateway/execution/adapters/products-update-adapter.ts',
  'lib/agent-gateway/execution/adapters/products-archive-adapter.ts',
];

adapterFiles.forEach(file => {
  totalChecks++;
  if (checkFileExists(file)) passedChecks++;
});

// Check 2: Adapters are imported in index.ts
log('\n2. Checking adapter imports...', COLORS.blue);
const indexPath = 'lib/agent-gateway/execution/adapters/index.ts';
const imports = [
  { search: 'ProductsCreateDraftAdapter', desc: 'ProductsCreateDraftAdapter import' },
  { search: 'ProductsUpdateAdapter', desc: 'ProductsUpdateAdapter import' },
  { search: 'ProductsArchiveAdapter', desc: 'ProductsArchiveAdapter import' },
];

imports.forEach(({ search, desc }) => {
  totalChecks++;
  if (checkFileContains(indexPath, search, desc)) passedChecks++;
});

// Check 3: Adapters are registered
log('\n3. Checking adapter registration...', COLORS.blue);
const registrations = [
  { search: 'new ProductsCreateDraftAdapter()', desc: 'ProductsCreateDraftAdapter registered' },
  { search: 'new ProductsUpdateAdapter()', desc: 'ProductsUpdateAdapter registered' },
  { search: 'new ProductsArchiveAdapter()', desc: 'ProductsArchiveAdapter registered' },
];

registrations.forEach(({ search, desc }) => {
  totalChecks++;
  if (checkFileContains(indexPath, search, desc)) passedChecks++;
});

// Check 4: Capability definitions exist
log('\n4. Checking capability definitions...', COLORS.blue);
const manifestPath = 'lib/agent-gateway/capabilities/manifest.ts';
const capabilities = [
  { search: 'const productsUpdate:', desc: 'productsUpdate definition' },
  { search: 'const productsArchive:', desc: 'productsArchive definition' },
  { search: 'id: "products.createDraft"', desc: 'products.createDraft capability' },
  { search: 'id: "products.update"', desc: 'products.update capability' },
  { search: 'id: "products.archive"', desc: 'products.archive capability' },
];

capabilities.forEach(({ search, desc }) => {
  totalChecks++;
  if (checkFileContains(manifestPath, search, desc)) passedChecks++;
});

// Check 5: Capabilities are in manifest array
log('\n5. Checking manifest array...', COLORS.blue);
const manifestArray = [
  { search: 'productsCreateDraft,', desc: 'productsCreateDraft in array' },
  { search: 'productsUpdate,', desc: 'productsUpdate in array' },
  { search: 'productsArchive,', desc: 'productsArchive in array' },
];

manifestArray.forEach(({ search, desc }) => {
  totalChecks++;
  if (checkFileContains(manifestPath, search, desc)) passedChecks++;
});

// Check 6: Domain readiness updated
log('\n6. Checking domain readiness...', COLORS.blue);
const readinessPath = 'lib/agent-gateway/capabilities/domain-readiness.ts';
const readiness = [
  { search: 'operation: "create a product draft", readiness: "READY"', desc: 'products.createDraft marked READY' },
  { search: 'operation: "update a product draft", readiness: "READY"', desc: 'products.update marked READY' },
  { search: 'operation: "archive a product", readiness: "READY"', desc: 'products.archive marked READY' },
];

readiness.forEach(({ search, desc }) => {
  totalChecks++;
  if (checkFileContains(readinessPath, search, desc)) passedChecks++;
});

// Check 7: Adapter class structures
log('\n7. Checking adapter implementations...', COLORS.blue);
const adapterChecks = [
  { file: adapterFiles[0], search: 'class ProductsCreateDraftAdapter implements AgentCapabilityAdapter', desc: 'ProductsCreateDraftAdapter implements interface' },
  { file: adapterFiles[0], search: 'capabilityId = "products.createDraft"', desc: 'ProductsCreateDraftAdapter has correct ID' },
  { file: adapterFiles[1], search: 'class ProductsUpdateAdapter implements AgentCapabilityAdapter', desc: 'ProductsUpdateAdapter implements interface' },
  { file: adapterFiles[1], search: 'capabilityId = "products.update"', desc: 'ProductsUpdateAdapter has correct ID' },
  { file: adapterFiles[2], search: 'class ProductsArchiveAdapter implements AgentCapabilityAdapter', desc: 'ProductsArchiveAdapter implements interface' },
  { file: adapterFiles[2], search: 'capabilityId = "products.archive"', desc: 'ProductsArchiveAdapter has correct ID' },
];

adapterChecks.forEach(({ file, search, desc }) => {
  totalChecks++;
  if (checkFileContains(file, search, desc)) passedChecks++;
});

// Summary
log('\n═══════════════════════════════════════════════════════════════', COLORS.blue);
log('Verification Summary', COLORS.blue);
log('═══════════════════════════════════════════════════════════════\n', COLORS.blue);

const percentage = Math.round((passedChecks / totalChecks) * 100);
log(`Checks passed: ${passedChecks}/${totalChecks} (${percentage}%)`, passedChecks === totalChecks ? COLORS.green : COLORS.yellow);

if (passedChecks === totalChecks) {
  log('\n✓ All checks passed! Product mutation capabilities are properly installed.', COLORS.green);
  log('\nNext steps:', COLORS.blue);
  log('  1. Build the project: npm run build');
  log('  2. Commit changes: git add lib/ && git commit -m "feat: Add product mutations"');
  log('  3. Push to production: git push origin master');
  log('  4. Deploy: npm run build && pm2 restart all\n');
  process.exit(0);
} else {
  log('\n✗ Some checks failed. Please review the errors above.', COLORS.red);
  log('\nTroubleshooting:', COLORS.yellow);
  log('  - Ensure all adapter files were created correctly');
  log('  - Check that imports match file names exactly');
  log('  - Verify capability definitions are properly formatted\n');
  process.exit(1);
}
