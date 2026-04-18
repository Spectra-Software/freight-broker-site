import { google } from "googleapis";

function getOAuthClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return oauth2Client;
}

function getGmail(accessToken: string) {
  return google.gmail({
    version: "v1",
    auth: getOAuthClient(accessToken),
  });
}

// =========================
// SEND EMAIL
// =========================
export async function sendEmail({
  accessToken,
  to,
  subject,
  body,
}: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
}) {
  const gmail = getGmail(accessToken);

  const raw = Buffer.from(
    [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      body,
    ].join("\r\n")
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

// =========================
// INBOX
// =========================
export async function fetchInbox(accessToken: string) {
  const gmail = getGmail(accessToken);

  const res = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults: 20,
  });

  const messages = res.data.messages || [];

  return Promise.all(
    messages.map(async (m) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
      });

      return full.data;
    })
  );
}

// =========================
// SENT MAIL
// =========================
export async function fetchSent(accessToken: string) {
  const gmail = getGmail(accessToken);

  const res = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
    maxResults: 20,
  });

  const messages = res.data.messages || [];

  return Promise.all(
    messages.map(async (m) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
      });

      return full.data;
    })
  );
}