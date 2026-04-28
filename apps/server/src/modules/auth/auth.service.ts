import { AppError } from "@/errors/app.error";
import type {
  ErrorResponse,
  GitHubEmail,
  GitHubUser,
  SuccessResponse,
} from "@/misc/types";
import {
  catchAndThrowError,
  generateAccessToken,
  generateRefreshToken,
  makeGitHubHeaders,
  verifyRefreshToken,
} from "@/misc/utils";
import type { githubCallbackSchema } from "@/schema/auth.schema";
import axios, { AxiosError, type AxiosResponse } from "axios";
import { StatusCodes } from "http-status-codes";
import * as authRepository from "@/modules/auth/auth.repository";
import type z from "zod";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import {
  findToken,
  rotateToken,
  revokeToken,
} from "@/modules/auth/auth.repository";

type StandardServiceResponse<S = SuccessResponse, E = ErrorResponse> = Promise<{
  statusCode: number;
  body?: S | E;
}>;

export const hash = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export async function createUser(
  payload: z.infer<typeof githubCallbackSchema>,
): StandardServiceResponse<{
  status: "success";
  message: string;
  data: {
    refresh_token: string;
    access_token: string;
    username: string;
    role: string;
    expiresAt: Date;
  };
}> {
  const tokenRequest = await catchAndThrowError(
    async () =>
      (await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
          client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
          code: payload.code,
          redirect_uri: `http://127.0.0.1:${process.env.PORT}/callback`,
          code_verifier: payload.code_verifier,
        },
        {
          headers: { Accept: "application/json" },
        },
      )) as AxiosResponse<{
        access_token?: string;
        token_type?: "bearer";
        scope?: string;
        error?: string;
        error_description?: string;
      }>,
    {
      AxiosError: {
        errorClass: AxiosError,
        getCode: (err) => {
          if (axios.isAxiosError(err)) {
            return err.response?.status ?? StatusCodes.INTERNAL_SERVER_ERROR;
          }
          return StatusCodes.INTERNAL_SERVER_ERROR;
        },
      },
    },
  );

  const accessToken = tokenRequest.data.access_token;

  if (!accessToken) {
    throw new Error(
      `GitHub OAuth failed: ${tokenRequest.data.error_description ?? tokenRequest.data.error ?? "no access_token returned"}`,
    );
  }

  const githubHeaders = makeGitHubHeaders(accessToken);

  const [userResponse, emailsResponse] = await Promise.all([
    catchAndThrowError(
      async () =>
        (await axios.get("https://api.github.com/user", {
          headers: githubHeaders,
        })) as AxiosResponse<GitHubUser>,
      {},
    ),
    catchAndThrowError(
      async () =>
        (await axios.get("https://api.github.com/user/emails", {
          headers: githubHeaders,
        })) as AxiosResponse<GitHubEmail[]>,
      {},
    ),
  ]);

  const githubUser = userResponse.data;

  const primaryEmail = emailsResponse.data.find((e) => e.primary)?.email;

  if (!primaryEmail) {
    throw new AppError({
      message: "Could not retrieve a verified email address from GitHub.",
      code: StatusCodes.BAD_GATEWAY,
    });
  }

  const result = await authRepository.createUser({
    avatar_url: githubUser.avatar_url,
    email: primaryEmail,
    username: githubUser.login,
    github_id: String(githubUser.id),
    is_active: true,
  });

  const jwtAccessToken = generateAccessToken({
    role: result.role,
    userId: result.id,
  });

  const jwtRefreshToken = generateRefreshToken({
    role: result.role,
    userId: result.id,
    jti: uuidv4(),
  });

  const { expires_at: jwtRefreshTokenExpiryDate } =
    await authRepository.saveToken({
      userId: result.id,
      token: jwtRefreshToken,
    });

  return {
    statusCode: StatusCodes.OK,
    body: {
      data: {
        access_token: jwtAccessToken,
        role: result.role,
        username: result.username,
        refresh_token: jwtRefreshToken,
        expiresAt: jwtRefreshTokenExpiryDate,
      },
      status: "success",
      message: "Profile retrieved successfully",
    },
  };
}

export async function refreshToken(token: string): StandardServiceResponse<{
  status: "success";
  message: string;
  data: {
    refresh_token: string;
    access_token: string;
    expiresAt: Date;
  };
}> {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new AppError({
      message: "Invalid or expired refresh token",
      code: StatusCodes.UNAUTHORIZED,
    });
  }

  // Check token is still in store (not revoked)
  const stored = await findToken({ userId: decoded.userId, token });
  if (!stored)
    return {
      statusCode: StatusCodes.UNAUTHORIZED,
      body: {
        status: "error",
        message: "Refresh token revoked",
      },

      // body: {

      // }
    };

  // Rotate — issue a new pair and invalidate the old one
  const payload = { userId: decoded.userId, role: decoded.role };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken({ ...payload, jti: uuidv4() });

  const { expiresAt } = await rotateToken({
    oldToken: token,
    newToken: newRefreshToken,
    userId: payload.userId,
  });

  return {
    statusCode: StatusCodes.OK,
    body: {
      status: "success",
      message: "Token refreshed successfully",
      data: {
        access_token: newAccessToken,
        expiresAt,
        refresh_token: newRefreshToken,
      },
    },
  };
}

export async function logout(token: string) {
  const decoded = verifyRefreshToken(token);
  try {
    return await revokeToken({
      userId: decoded.userId,
      oldToken: token,
    });
  } catch {
    return;
  }
}
