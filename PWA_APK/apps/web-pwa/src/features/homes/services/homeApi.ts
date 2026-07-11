import type {
  AuthSession,
  HomeDashboardResponse,
  HomeMemberRecord,
  HomeRecord,
  HomeShareCodeRecord
} from "@jenix/shared";

import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import {
  createDemoHome,
  createDemoHomeShareCode,
  deleteDemoHome,
  getDemoHomeDashboard,
  homeDemoStoreTesting,
  listDemoHomeMembers,
  listDemoHomes,
  listDemoHomeShareCodes,
  redeemDemoHomeShareCode,
  revokeDemoHomeMember,
  updateDemoHome,
  updateDemoHomeMemberAccess,
  updateDemoHomeMemberRole
} from "./homeDemoStore";

const homeEndpoint = "/api/v1/homes";

export interface CreateHomeShareCodeInput {
  role: "admin" | "member" | "viewer";
  expiresInHours?: number;
}

export interface HomeUpsertInput {
  name: string;
  timezone?: string;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
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

export async function createHome(
  session: AuthSession,
  input: HomeUpsertInput
): Promise<HomeRecord> {
  try {
    return await fetchJson<HomeRecord>(homeEndpoint, {
      method: "POST",
      headers: createAuthenticatedHeaders(session, {
        contentType: "application/json"
      }),
      body: JSON.stringify(input)
    });
  } catch {
    return createDemoHome({
      userId: session.user.userId,
      userName: session.user.name,
      userEmail: session.user.email,
      ...input
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

export async function getHomeDashboard(
  session: AuthSession,
  homeId: string
): Promise<HomeDashboardResponse> {
  try {
    return await fetchJson<HomeDashboardResponse>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/dashboard`,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session)
      }
    );
  } catch {
    return getDemoHomeDashboard({
      homeId,
      userId: session.user.userId
    });
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

export async function updateHome(
  session: AuthSession,
  homeId: string,
  input: HomeUpsertInput
): Promise<HomeRecord> {
  try {
    return await fetchJson<HomeRecord>(`${homeEndpoint}/${encodeURIComponent(homeId)}`, {
      method: "PATCH",
      headers: createAuthenticatedHeaders(session, {
        contentType: "application/json"
      }),
      body: JSON.stringify(input)
    });
  } catch {
    return updateDemoHome({
      homeId,
      userId: session.user.userId,
      ...input
    });
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

export async function updateHomeMemberAccess(
  session: AuthSession,
  homeId: string,
  userId: string,
  allowed: boolean
): Promise<HomeMemberRecord[]> {
  try {
    return await fetchJson<HomeMemberRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/members/${encodeURIComponent(userId)}/access`,
      {
        method: "PATCH",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json"
        }),
        body: JSON.stringify({ allowed })
      }
    );
  } catch {
    return updateDemoHomeMemberAccess({
      homeId,
      actorUserId: session.user.userId,
      targetUserId: userId,
      allowed
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

export async function deleteHome(
  session: AuthSession,
  homeId: string
): Promise<HomeRecord[]> {
  try {
    return await fetchJson<HomeRecord[]>(`${homeEndpoint}/${encodeURIComponent(homeId)}`, {
      method: "DELETE",
      headers: createAuthenticatedHeaders(session)
    });
  } catch {
    return deleteDemoHome({
      homeId,
      userId: session.user.userId
    });
  }
}

export const homeApiTesting = {
  reset() {
    homeDemoStoreTesting.reset();
  }
};
