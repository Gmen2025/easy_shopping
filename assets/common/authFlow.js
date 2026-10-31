export const authErrorMessage = (error) => {
  const data = error?.response?.data;
  return (typeof data === "string" && data) ||
    (typeof data?.message === "string" && data.message) ||
    (typeof error?.message === "string" && error.message) ||
    "Authentication is unavailable. Please try again.";
};

export const classifyAuthResponse = (data) => {
  if (!data || typeof data !== "object") {
    throw new Error("The server returned an invalid sign-in response.");
  }
  if (data.requiresTwoFactor === true) {
    if (data.token || typeof data.challengeId !== "string" || !data.challengeId ||
        !["authenticator", "email"].includes(data.method)) {
      throw new Error("The server returned an invalid verification challenge.");
    }
    return { challenge: data };
  }
  const { token, ...profile } = data;
  const user = profile.user || profile.profile || profile.data || profile;
  if (typeof token !== "string" || !token || (!user?._id && !user?.id)) {
    throw new Error("The server returned an incomplete sign-in response.");
  }
  return { token, user };
};

export const parseSocialCallback = (callbackUrl, redirectUri) => {
  const callback = new URL(callbackUrl);
  const expected = new URL(redirectUri);
  if (callback.protocol !== expected.protocol || callback.host !== expected.host ||
      callback.pathname !== expected.pathname) {
    throw new Error("The sign-in callback did not match this app.");
  }
  if (callback.searchParams.has("error")) {
    const error = callback.searchParams.get("error");
    if (error === "social_login_disabled")
      throw new Error("Social sign-in is disabled. Please use email sign-in.");
    if (error === "account_conflict")
      throw new Error("An account with this email already exists in this store. Sign in using the method you used to create it. Google, Apple, and Facebook sign-in cannot automatically link to an existing email/password account. To add Google, sign in first, then open Profile > Security Settings > Link Google account.");
    if (error === "email_required")
      throw new Error("Your sign-in provider did not share an email address. Allow email access or use email sign-in.");
    if (error === "provider_unavailable")
      throw new Error("This sign-in provider is not configured on the server. Please use email sign-in and contact support.");
    if (error === "link_email_mismatch")
      throw new Error("Choose the Google account with the same email as your existing account.");
    if (error === "link_expired")
      throw new Error("Your account security changed. Start Google linking again.");
    throw new Error("Social sign-in was not completed. Check your provider configuration or try email sign-in.");
  }
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("The sign-in provider did not return an authorization code.");
  return code;
};

export const resendSecondsRemaining = (availableAt, now = Date.now()) =>
  Math.max(0, Math.ceil((availableAt - now) / 1000));
