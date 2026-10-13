const { resetDbToSeed } = require('./db');

console.log('Seeding Department Inventory & Issue Management System...');
const seeded = resetDbToSeed();
console.log('✅ Seed completed successfully!');
console.log(`- Locations: ${seeded.locations.length}`);
console.log(`- Items: ${seeded.items.length}`);
console.log(`- Assets: ${seeded.assets.length}`);
console.log(`- Students: ${seeded.students.length}`);
console.log(`- Initial Issues: ${seeded.issues.length}`);
console.log(`- Initial Renewals: ${seeded.renewals.length}`);
