export function buildTestAuthPayload({
  adminAccessToken,
  adminRefreshToken,
  analystAccessToken,
  analystRefreshToken,
}: {
  adminAccessToken: string;
  adminRefreshToken: string;
  analystAccessToken: string;
  analystRefreshToken: string;
}) {
  return {
    // flat generic
    access_token: adminAccessToken,
    refresh_token: adminRefreshToken,

    // role-specific flat
    admin_access_token: adminAccessToken,
    admin_refresh_token: adminRefreshToken,
    analyst_access_token: analystAccessToken,
    analyst_refresh_token: analystRefreshToken,

    // grouped structure
    admin: {
      access_token: adminAccessToken,
      refresh_token: adminRefreshToken,
      token: adminAccessToken,
    },

    analyst: {
      access_token: analystAccessToken,
      refresh_token: analystRefreshToken,
      token: analystAccessToken,
    },

    // alternative casing style (some bots are picky)
    tokens: {
      admin: {
        accessToken: adminAccessToken,
        refreshToken: adminRefreshToken,
      },
      analyst: {
        accessToken: analystAccessToken,
        refreshToken: analystRefreshToken,
      },
    },

    // extra redundancy fallback
    test_admin: {
      access_token: adminAccessToken,
      refresh_token: adminRefreshToken,
    },
    test_analyst: {
      access_token: analystAccessToken,
      refresh_token: analystRefreshToken,
    },
  };
}
