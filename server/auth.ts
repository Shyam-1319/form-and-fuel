import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./auth-schema";
import type { Env } from "./types";
export function createAuth(env: Env) {
  return betterAuth({
    appName: "Form & Fuel",
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: "sqlite",
      schema,
      transaction: false,
    }),
    trustedOrigins: [env.APP_URL],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: env.APP_URL.startsWith("https://"),
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 20,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 3600, max: 5 },
        "/email-otp/*": { window: 60, max: 5 },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 8,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "hashed",
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        disableSignUp: true,
        async sendVerificationOTP({ email, otp, type }) {
          if (!env.RESEND_API_KEY)
            throw new Error("Email delivery is not configured");
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: env.EMAIL_FROM,
              to: [email],
              subject: `Form & Fuel: ${type === "forget-password" ? "password reset" : "verify your email"}`,
              text: `Your Form & Fuel code is ${otp}. It expires in 10 minutes and can be used once. If you did not request this, ignore this message.`,
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error("Email delivery unavailable");
        },
      }),
    ],
  });
}
