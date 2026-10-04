export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GmailTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

export class GmailOAuthClient {
  constructor(private readonly config: GmailOAuthConfig) {}

  getAuthorizationUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: "https://www.googleapis.com/auth/gmail.modify",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<GmailTokenResponse> {
    return this.tokenRequest({
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    });
  }

  async refresh(refreshToken: string): Promise<GmailTokenResponse> {
    return this.tokenRequest({
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "refresh_token",
    });
  }

  private async tokenRequest(body: Record<string, string>): Promise<GmailTokenResponse> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    if (!response.ok) throw new Error("Google OAuth token exchange failed: " + (await response.text()).slice(0, 500));
    return response.json() as Promise<GmailTokenResponse>;
  }
}
