// Creates the admin account. Admins cannot sign up through the public API,
// so this script (run by someone with server access) is the only way in.
//
//   npm run seed:admin
//
// Reads ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD from backend/.env.
import { z } from 'zod';
import { connectDB, disconnectDB } from '../config/db.js';
import { UserModel } from '../models/User.js';
import { hashPassword } from '../utils/password.js';

const adminSchema = z.object({
  ADMIN_NAME: z.string().trim().min(2).default('Administrator'),
  ADMIN_EMAIL: z.email('ADMIN_EMAIL must be a valid email').trim().toLowerCase(),
  ADMIN_PASSWORD: z
    .string({ error: 'ADMIN_PASSWORD is required' })
    .min(8, 'ADMIN_PASSWORD must be at least 8 characters')
    .max(72),
});

async function main(): Promise<number> {
  const parsed = adminSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Missing or invalid admin settings in .env:');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    return 1;
  }
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = parsed.data;

  await connectDB();
  try {
    const existing = await UserModel.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      if (existing.role === 'admin') {
        console.log(`Admin ${ADMIN_EMAIL} already exists. Nothing to do.`);
        return 0;
      }
      // Never silently promote an existing account to admin.
      console.error(
        `${ADMIN_EMAIL} is already registered as "${existing.role}". Use a different ADMIN_EMAIL.`,
      );
      return 1;
    }

    await UserModel.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: await hashPassword(ADMIN_PASSWORD),
      role: 'admin',
    });
    console.log(`Admin created: ${ADMIN_EMAIL}`);
    return 0;
  } finally {
    await disconnectDB();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Seeding failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
