import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  // Use a default password if not specified in environment
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const adminName = 'System Admin';

  console.log('Seeding database...');

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: 'ADMIN',
    },
  });

  if (existingAdmin) {
    console.log(`Admin user already exists with email: ${existingAdmin.email}`);
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Create the admin user
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log(`Successfully created admin user: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
