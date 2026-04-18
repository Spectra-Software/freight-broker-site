if (account) {
  token.accessToken = account.access_token;
  token.refreshToken = account.refresh_token ?? token.refreshToken;
  token.accessTokenExpires = account.expires_at
    ? account.expires_at * 1000
    : undefined;

  // 🔥 SAFE DB WRITE (WON’T BREAK LOGIN)
  try {
    if (token.email) {
      await prisma.user.update({
        where: { email: token.email },
        data: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken || undefined,
          tokenExpiry: token.accessTokenExpires
            ? new Date(token.accessTokenExpires)
            : null,
        },
      });
    }
  } catch (err) {
    console.error("TOKEN SAVE ERROR:", err);
  }
}