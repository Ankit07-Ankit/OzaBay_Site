import nodemailer from "nodemailer";
import config from "../config/config.js";

const gmailApiUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const oauthTokenUrl = "https://oauth2.googleapis.com/token";
const requestTimeoutMs = 10000;
const maxSendAttempts = 3;

const messageTransport = nodemailer.createTransport({
  streamTransport: true,
  buffer: true,
  newline: "unix",
});

let accessToken;
let accessTokenExpiresAt = 0;

const getAccessToken = async ({ forceRefresh = false } = {}) => {
  if (forceRefresh) {
    accessToken = undefined;
    accessTokenExpiresAt = 0;
  }
  if (accessToken && Date.now() < accessTokenExpiresAt - 60000) {
    return accessToken;
  }

  const response = await fetch(oauthTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      refresh_token: config.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.error_description || body.error || "";
    } catch {
      // Keep the HTTP status useful even when Google returns a non-JSON error.
    }
    const error = new Error(
      `Google OAuth token request failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
    error.statusCode = response.status;
    throw error;
  }

  const token = await response.json();
  const expiresIn = Number(token.expires_in);
  if (
    typeof token.access_token !== "string"
    || !Number.isFinite(expiresIn)
    || expiresIn <= 0
  ) {
    throw new Error("Google OAuth returned an invalid access token");
  }

  accessToken = token.access_token;
  accessTokenExpiresAt = Date.now() + expiresIn * 1000;
  return accessToken;
};

const readGmailApiError = async (response) => {
  let detail = "";
  try {
    const body = await response.json();
    detail = body.error?.message || body.error_description || "";
  } catch {
    // Preserve the HTTP status if the response body is not JSON.
  }
  const error = new Error(
    `Gmail API send failed (${response.status})${detail ? `: ${detail}` : ""}`,
  );
  error.statusCode = response.status;
  return error;
};

const waitBeforeRetry = (attempt) =>
  new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));

const sendWithGmailApi = async (mailOptions) => {
  const { message } = await messageTransport.sendMail(mailOptions);
  let refreshedAfterUnauthorized = false;
  let forceRefreshNextAttempt = false;

  for (let attempt = 0; attempt < maxSendAttempts; attempt += 1) {
    try {
      const token = await getAccessToken({
        forceRefresh: forceRefreshNextAttempt,
      });
      forceRefreshNextAttempt = false;
      const response = await fetch(gmailApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: message.toString("base64url") }),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });

      if (response.ok) return;

      const error = await readGmailApiError(response);
      if (response.status === 401 && !refreshedAfterUnauthorized) {
        refreshedAfterUnauthorized = true;
        forceRefreshNextAttempt = true;
        continue;
      }
      if (response.status !== 429 && response.status < 500) throw error;
      if (attempt === maxSendAttempts - 1) throw error;
    } catch (error) {
      const retryable =
        !Number.isInteger(error.statusCode)
        || error.statusCode === 429
        || error.statusCode >= 500;
      if (!retryable || attempt === maxSendAttempts - 1) throw error;
    }

    await waitBeforeRetry(attempt);
  }
};

const sendEmail = async (to, subject, text, html) => {
  try {
    await sendWithGmailApi({
      from: `"OzaBay" <${config.EMAIL_FROM}>`,
      ...(config.EMAIL_REPLY_TO ? { replyTo: config.EMAIL_REPLY_TO } : {}),
      to,
      subject,
      text,
      html,
    });
    console.log("Email accepted by Gmail");
  } catch (error) {
    console.error("Error sending email:", {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      statusCode: error.statusCode || error.cause?.statusCode,
      message: error.message,
      cause: error.cause?.message,
    });
    throw new Error("Failed to send email", { cause: error });
  }
};

export default sendEmail;
