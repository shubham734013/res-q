const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Change provider
schema = schema.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');

// Replace Decimal to Float
schema = schema.replace(/Decimal\s+@db\.Decimal\(\d+,\s*\d+\)/g, 'Float');

// Replace enums with String and defaults
const enums = [
  'UserRole',
  'UserStatus',
  'FacilityType',
  'VerificationStatus',
  'SourceType',
  'ResourceType',
  'AvailabilityStatus',
  'FreshnessStatus',
  'ReportCategory',
  'ReportStatus',
  'EmergencySessionStatus',
  'BloodGroup',
  'BloodComponent',
  'AmbulanceType'
];

for (const e of enums) {
  // Replace enum usages and their defaults
  const regex1 = new RegExp(`${e}\\s+@default\\(([A_Z_]+)\\)`, 'g');
  schema = schema.replace(regex1, `String @default("$1")`);
  
  const regex2 = new RegExp(`${e}\\s*\\?`, 'g');
  schema = schema.replace(regex2, 'String?');
  
  const regex3 = new RegExp(`${e}(\\s+)`, 'g');
  schema = schema.replace(regex3, 'String$1');
}

// Remove enum definitions
schema = schema.replace(/enum \w+ \{[^}]+\}/g, '');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Converted to SQLite');
