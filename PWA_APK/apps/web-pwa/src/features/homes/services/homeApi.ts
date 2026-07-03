import type {
  AuthSession,
  HomeMemberRecord,
  HomeRecord,
  HomeShareCodeRecord
} from "@jenix/shared";

import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import {
  createDemoHomeShareCode,
  homeDemoStoreTesting,
  listDemoHomeMembers,
  listDemoHomes,
  listDemoHomeShareCodes,
  redeemDemoHomeShareCode,
  revokeDemoHomeMember,
  updateDemoHomeMemberRole
} from "./homeDemoStore";

const homeEndpoint = "/api/v1/homes";

export interface CreateHomeShareCodeInput {
  role: "admin" | "member" | "viewer";
  expiresInHours?: number;
}

export interface HomeRedeemResponse {
  home: HomeRecord;
  homes: HomeRecord[];
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export async function listHomes(session: AuthSession): Promise<HomeRecord[]> {
  try {
    return await fetchJson<HomeRecord[]>(homeEndpoint, {
      method: "GET",
      headers: createAuthenticatedHeaders(session)
    });
  } catch {
    return listDemoHomes({
      userId: session.user.userId,
      userName: session.user.name,
      userEmail: session.user.email
    });
  }
}

export async function listHomeMembers(
  session: AuthSession,
  homeId: string
): Promise<HomeMemberRecord[]> {
  try {
    return await fetchJson<HomeMemberRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/members`,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session)
      }
    );
  } catch {
    return listDemoHomeMembers(homeId, session.user.userId);
  }
}

export async function listHomeShareCodes(
  session: AuthSession,
  homeId: string
): Promise<HomeShareCodeRecord[]> {
  try {
    return await fetchJson<HomeShareCodeRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/share-codes`,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session)
      }
    );
  } catch {
    return listDemoHomeShareCodes(homeId, session.user.userId);
  }
}

export async function createHomeShareCode(
  session: AuthSession,
  homeId: string,
  input: CreateHomeShareCodeInput
): Promise<HomeShareCodeRecord> {
  try {
    return await fetchJson<HomeShareCodeRecord>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/share-codes`,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json"
        }),
        body: JSON.stringify(input)
      }
    );
  } catch {
    return createDemoHomeShareCode({
      homeId,
      userId: session.user.userId,
      role: input.role,
      ...(input.expiresInHours !== undefined
        ? { expiresInHours: input.expiresInHours }
        : {})
    });
  }
}

export async function redeemHomeShareCode(
  session: AuthSession,
  code: string
): Promise<HomeRedeemResponse> {
  try {
    return await fetchJson<HomeRedeemResponse>(`${homeEndpoint}/redeem`, {
      method: "POST",
      headers: createAuthenticatedHeaders(session, {
        contentType: "application/json"
      }),
      body: JSON.stringify({
        code
      })
    });
  } catch {
    return redeemDemoHomeShareCode({
      userId: session.user.userId,
      userName: session.user.name,
      userEmail: session.user.email,
      code
    });
  }
}

export async function updateHomeMemberRole(
  session: AuthSession,
  homeId: string,
  userId: string,
  role: "admin" | "member" | "viewer"
): Promise<HomeMemberRecord[]> {
  try {
    return await fetchJson<HomeMemberRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/members/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json"
        }),
        body: JSON.stringify({
          role
        })
      }
    );
  } catch {
    return updateDemoHomeMemberRole({
      homeId,
      actorUserId: session.user.userId,
      targetUserId: userId,
      role
    });
  }
}

export async function revokeHomeMember(
  session: AuthSession,
  homeId: string,
  userId: string
): Promise<HomeMemberRecord[]> {
  try {
    return await fetchJson<HomeMemberRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/members/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: createAuthenticatedHeaders(session)
      }
    );
  } catch {
    return revokeDemoHomeMember({
      homeId,
      actorUserId: session.user.userId,
      targetUserId: userId
    });
  }
}

export const homeApiTesting = {
  reset() {
    homeDemoStoreTesting.reset();
  }
};
