import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

export const env = {
  // ------------------------------------------------------------
  // Application
  // ------------------------------------------------------------

  nodeEnv: process.env.NODE_ENV ?? "development",

  isProduction:
    process.env.NODE_ENV === "production",

  port: Number(process.env.PORT ?? 5000),

  // ------------------------------------------------------------
  // API / Frontend
  // ------------------------------------------------------------

  apiBaseUrl:
    process.env.API_BASE_URL ??
    "http://localhost:5000",

  clientUrl:
    process.env.CLIENT_URL ??
    "http://localhost:5174",

  /*
   * Frontend origins allowed to access the API.
   *
   * Example:
   * CORS_ORIGINS=http://localhost:5173,http://localhost:5174
   */
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    "http://localhost:5173,http://localhost:5174"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // ------------------------------------------------------------
  // Authentication
  // ------------------------------------------------------------

  authSecret: required(
    "AUTH_SECRET",
    "dev-secret-change-me",
  ),

  sessionTtlHours: Number(
    process.env.SESSION_TTL_HOURS ?? 24,
  ),

  cookieSecure:
    process.env.COOKIE_SECURE === "true",

  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : "",

  // ------------------------------------------------------------
  // Database
  // ------------------------------------------------------------

  databaseUrl: required("DATABASE_URL"),

  // ------------------------------------------------------------
  // Razorpay
  // ------------------------------------------------------------

  razorpayKeyId:
    process.env.RAZORPAY_KEY_ID ?? "",

  razorpayKeySecret:
    process.env.RAZORPAY_KEY_SECRET ?? "",

  razorpayWebhookSecret:
    process.env.RAZORPAY_WEBHOOK_SECRET ?? "",

  // ------------------------------------------------------------
  // WhatsApp Business API
  // ------------------------------------------------------------

  whatsappAccessToken:
    process.env.WHATSAPP_ACCESS_TOKEN ?? "",

  whatsappPhoneNumberId:
    process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",

  whatsappBusinessAccountId:
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "",

  // ------------------------------------------------------------
  // Email / SMTP
  // ------------------------------------------------------------

  smtpHost:
    process.env.SMTP_HOST ?? "",

  smtpPort: Number(
    process.env.SMTP_PORT ?? 587,
  ),

  smtpUser:
    process.env.SMTP_USER ?? "",

  smtpPassword:
    process.env.SMTP_PASSWORD ?? "",

  emailFrom:
    process.env.EMAIL_FROM ??
    "Rentals <no-reply@c2dtech.in>",

  // ------------------------------------------------------------
  // Storage
  // ------------------------------------------------------------

  storageEndpoint:
    process.env.STORAGE_ENDPOINT ?? "",

  storageAccessKey:
    process.env.STORAGE_ACCESS_KEY ?? "",

  storageSecretKey:
    process.env.STORAGE_SECRET_KEY ?? "",

  storageBucket:
    process.env.STORAGE_BUCKET ?? "",

  // ------------------------------------------------------------
  // Cloudinary Cloud Storage
  // ------------------------------------------------------------

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "c5rjvjvf",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "872197226253975",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "Ha91wM6Wi-V-io1jX_CiaE5eI8Q",
  cloudinaryUrl: process.env.CLOUDINARY_URL ?? "cloudinary://872197226253975:Ha91wM6Wi-V-io1jX_CiaE5eI8Q@c5rjvjvf",

  // ------------------------------------------------------------
  // Redis
  // ------------------------------------------------------------

  redisUrl:
    process.env.REDIS_URL ?? "",
} as const;