import nodemailer from "nodemailer";
import config from "../config/config.js";

const gmailApiUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const oauthTokenUrl = "https://oauth2.googleapis.com/token";
const requestTimeoutMs = 10000;

const messageTransport = nodemailer.createTransport({
  streamTransport: true,
  buffer: true,
  newline: "unix",
});

let accessToken;
let accessTokenExpiresAt = 0;

const getAccessToken = async () => {
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
    throw new Error(`Google OAuth token request failed (${response.status})`);
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

const sendWithGmailApi = async (mailOptions) => {
  const { message } = await messageTransport.sendMail(mailOptions);
  const response = await fetch(gmailApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: message.toString("base64url") }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Gmail API send failed (${response.status})`);
  }
};

const sendEmail = async (to, subject, text, html) => {
  try {
    await sendWithGmailApi({
      from: `"OzaBay" <${config.GOOGLE_USER}>`,
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
      message: error.message,
    });
    throw new Error("Failed to send email", { cause: error });
  }
};

export default sendEmail;
