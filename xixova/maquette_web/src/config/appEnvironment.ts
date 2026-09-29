export type AppEnvironment = "production" | "staging";

export const appEnvironment: AppEnvironment =
  import.meta.env.VITE_APP_ENV === "staging" ? "staging" : "production";

export const isStagingEnvironment = (value: AppEnvironment = appEnvironment) =>
  value === "staging";
