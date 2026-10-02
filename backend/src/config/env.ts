import 'dotenv/config';
import { z } from 'zod';

// Validate environment variables once at startup so a missing/typo'd value
// crashes immediately with a clear message instead of failing later at runtime.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string({ error: 'MONGODB_URI is required' }).min(1, 'MONGODB_URI is required'),
  // Public address of the site. On Render it defaults to the service's own
  // https://<name>.onrender.com address (RENDER_EXTERNAL_URL).
  CLIENT_ORIGIN: z.url().default(process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5174'),
  // Number of proxies in front of the app in production (Render, Railway,
  // Nginx...). Needed so HTTPS detection and rate limiting see the real
  // protocol and client IP. 0 = the app is directly exposed.
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  // Origin of the Umami analytics script (e.g. https://cloud.umami.is), added
  // to the Content-Security-Policy so the browser allows it. Optional.
  ANALYTICS_ORIGIN: z.url().optional(),
  JWT_ACCESS_SECRET: z
    .string({ error: 'JWT_ACCESS_SECRET is required' })
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string({ error: 'JWT_REFRESH_SECRET is required' })
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  // Session length WITHOUT "Remember me" (cookie also dies when the browser closes).
  REFRESH_TOKEN_TTL: z.string().default('1d'),
  // Session length WITH "Remember me" checked.
  REMEMBER_ME_TTL: z.string().default('30d'),

  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  // Email (optional). Provider is chosen automatically:
  //   BREVO_API_KEY set           → Brevo HTTPS API (works on hosts that block SMTP, e.g. Render)
  //   else SMTP_USER + SMTP_PASS  → SMTP (e.g. Gmail, for local development)
  //   else                        → development only: links are printed to the console
  BREVO_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Sender shown on emails. With Brevo it must be a sender verified in your
  // Brevo account. Defaults to SMTP_USER.
  MAIL_FROM_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
  MAIL_FROM_NAME: z.string().default('AdaptiveLearn'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
