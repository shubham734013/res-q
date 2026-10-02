const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
schema = schema.replace(/@default\(([A-Z_]+)\)/g, '@default("$1")');
fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Fixed quotes');
