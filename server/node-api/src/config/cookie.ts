export type CookieSameSite = "lax" | "strict" | "none";

const configuredSameSite = process.env.COOKIE_SAME_SITE?.toLowerCase();

export const cookieSameSite: CookieSameSite =
  configuredSameSite === "none" || configuredSameSite === "strict"
    ? configuredSameSite
    : "lax";

export const cookieSecure =
  process.env.NODE_ENV === "production" || cookieSameSite === "none";

export const cookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: "/",
};
