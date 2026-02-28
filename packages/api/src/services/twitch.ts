export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string[];
  token_type: string;
};

export type TokenErrorResponse = {
  error: string;
  error_description?: string;
};

function buildForm(params: Record<string, string>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.append(key, value);
  }
  return body;
}

async function postForm<T>(url: string, params: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildForm(params)
  });
  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}

export async function requestDeviceCode(clientId: string, scopes: string[]) {
  const { ok, data } = await postForm<DeviceCodeResponse>("https://id.twitch.tv/oauth2/device", {
    client_id: clientId,
    scopes: scopes.join(" ")
  });
  if (!ok) {
    throw new Error("Failed to start Twitch device flow.");
  }
  return data;
}

export async function exchangeDeviceCode(clientId: string, clientSecret: string | undefined, deviceCode: string) {
  const params: Record<string, string> = {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code"
  };
  if (clientSecret) {
    params.client_secret = clientSecret;
  }
  const { data } = await postForm<TokenResponse | TokenErrorResponse>(
    "https://id.twitch.tv/oauth2/token",
    params
  );
  return data;
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string | undefined,
  refreshToken: string
) {
  const params: Record<string, string> = {
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  };
  if (clientSecret) {
    params.client_secret = clientSecret;
  }
  const { ok, data } = await postForm<TokenResponse | TokenErrorResponse>(
    "https://id.twitch.tv/oauth2/token",
    params
  );
  if (!ok || "error" in data) {
    const reason = "error" in data ? data.error : "refresh_failed";
    throw new Error(`Twitch refresh failed (${reason}).`);
  }
  return data;
}
