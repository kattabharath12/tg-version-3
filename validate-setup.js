#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Railway deployment setup...\n');

let hasErrors = false;

// Check required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'AZURE_DOC_INTELLIGENCE_API_KEY',
  'AZURE_DOC_INTELLIGENCE_ENDPOINT'
];

console.log('📋 Checking environment variables:');
requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`  ✅ ${envVar} is set`);
  } else {
    console.log(`  ❌ ${envVar} is NOT set`);
    hasErrors = true;
  }
});

// Check if Prisma schema exists
console.log('\n📋 Checking Prisma setup:');
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
  console.log('  ✅ Prisma schema found');
} else {
  console.log('  ❌ Prisma schema NOT found');
  hasErrors = true;
}

// Check if uploads directory can be created
console.log('\n📋 Checking file storage setup:');
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`  ✅ Created uploads directory: ${uploadDir}`);
  } else {
    console.log(`  ✅ Uploads directory exists: ${uploadDir}`);
  }
  
  // Test write permissions
  const testFile = path.join(uploadDir, '.test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log('  ✅ Uploads directory is writable');
} catch (error) {
  console.log(`  ❌ Cannot write to uploads directory: ${error.message}`);
  hasErrors = true;
}

// Check required files
console.log('\n📋 Checking required files:');
const requiredFiles = [
  'package.json',
  'next.config.js',
  'tsconfig.json',
  'lib/file-storage.ts',
  'lib/azure-client.ts',
  'lib/db.ts',
  'app/api/upload/route.ts',
  'app/api/process-document/route.ts'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} NOT found`);
    hasErrors = true;
  }
});

// Check for AWS dependencies (should not exist)
console.log('\n📋 Checking for AWS dependencies:');
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const awsDeps = Object.keys(packageJson.dependencies || {}).filter(dep => dep.includes('aws'));
  
  if (awsDeps.length > 0) {
    console.log(`  ⚠️  AWS dependencies found (consider removing): ${awsDeps.join(', ')}`);
  } else {
    console.log('  ✅ No AWS dependencies found');
  }
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Validation FAILED - Please fix the errors above');
  process.exit(1);
} else {
  console.log('✅ Validation PASSED - Ready for Railway deployment!');
  process.exit(0);
}
