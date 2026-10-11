export interface EmailConnectionEnvironment {
  DATABASE_URL?: string;
  CREDENTIALS_MASTER_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  ZOHO_CLIENT_ID?: string;
  ZOHO_CLIENT_SECRET?: string;
  ZOHO_REDIRECT_URI?: string;
}

export interface EmailConnectionReadiness {
  databaseConfigured: boolean;
  credentialEncryptionConfigured: boolean;
  gmailOAuthConfigured: boolean;
  zohoOAuthConfigured: boolean;
  canPersistConnections: boolean;
}

function isPresent(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Returns safe readiness flags only; never return environment values to the browser. */
export function getEmailConnectionReadiness(
  environment: EmailConnectionEnvironment,
): EmailConnectionReadiness {
  const databaseConfigured = isPresent(environment.DATABASE_URL);
  const credentialEncryptionConfigured = isPresent(environment.CREDENTIALS_MASTER_KEY);
  const gmailOAuthConfigured =
    isPresent(environment.GOOGLE_CLIENT_ID) &&
    isPresent(environment.GOOGLE_CLIENT_SECRET) &&
    isPresent(environment.GOOGLE_REDIRECT_URI);
  const zohoOAuthConfigured =
    isPresent(environment.ZOHO_CLIENT_ID) &&
    isPresent(environment.ZOHO_CLIENT_SECRET) &&
    isPresent(environment.ZOHO_REDIRECT_URI);

  return {
    databaseConfigured,
    credentialEncryptionConfigured,
    gmailOAuthConfigured,
    zohoOAuthConfigured,
    canPersistConnections: databaseConfigured && credentialEncryptionConfigured,
  };
}
