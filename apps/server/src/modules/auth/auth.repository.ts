import { db } from "@/db/db";
import type { users } from "@/db/generated/types";
import { sql, type Insertable } from "kysely";
import { hash } from "@/modules/auth/auth.service";
import { addMinutes } from "date-fns";

export async function createUser(data: Insertable<users>) {
  const result = await db
    .insertInto("users")
    .values({
      last_login_at: sql`now()`,
      avatar_url: data.avatar_url,
      email: data.email,
      github_id: data.github_id,
      is_active: true,
      username: data.username,
    })
    .onConflict((oc) => {
      return oc.column("github_id").doUpdateSet((eb) => ({
        avatar_url: eb.ref("excluded.avatar_url"),
        email: eb.ref("excluded.email"),
        username: eb.ref("excluded.username"),
        last_login_at: eb.ref("excluded.last_login_at"),
        is_active: eb.ref("excluded.is_active"),
        id: eb.ref("excluded.id"),
        github_id: eb.ref("excluded.github_id"),
        created_at: eb.ref("excluded.created_at"),
        role: eb.ref("excluded.role"),
        updated_at: eb.ref("excluded.updated_at"),
      }));
    })
    .returning(["username", "role", "id"])
    .executeTakeFirst();

  return result;
}

export async function rotateToken({
  oldToken,
  newToken,
  userId,
}: {
  oldToken: string;
  newToken: string;
  userId: string;
}) {
  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("refresh_tokens")
      .where("user_id", "=", userId)
      .where("token_hash", "=", hash(oldToken))
      .execute();

    await trx
      .insertInto("refresh_tokens")
      .values({
        token_hash: hash(newToken),
        user_id: userId,
        expires_at: addMinutes(new Date(), 5),
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();
  });
}

export async function revokeToken({
  userId,
  oldToken,
}: {
  userId: string;
  oldToken: string;
}) {
  await db
    .deleteFrom("refresh_tokens")
    .where("user_id", "=", userId)
    .where("token_hash", "=", hash(oldToken))
    .execute();
}

export async function findToken(data: { userId: string; token: string }) {
  return await db
    .selectFrom("refresh_tokens")
    .where("token_hash", "=", hash(data.token))
    .where("user_id", "=", data.userId)
    .where("expires_at", ">", new Date())
    .executeTakeFirst();
}

export async function saveToken(data: { userId: string; token: string }) {
  return await db
    .insertInto("refresh_tokens")
    .values({
      token_hash: hash(data.token),
      user_id: data.userId,
      expires_at: addMinutes(new Date(), 5),
    })
    .returning(["expires_at"])
    .executeTakeFirstOrThrow();
}
