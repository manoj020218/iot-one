import type {
  AuthSession,
  HomeDashboardResponse,
  HomeMemberRecord,
  HomeRecord,
  HomeShareCodeRecord
} from "@jenix/shared";

import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import {
  fetchAuthenticatedJson,
  shouldUseDemoFallback
} from "../../../app/authenticatedRequest";
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

export async function listHomes(session: AuthSession): Promise<HomeRecord[]> {
  try {
    return await fetchAuthenticatedJson<HomeRecord[]>(homeEndpoint, session, {
      method: "GET",
      headers: createAuthenticatedHeaders(session)
    });
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
    return await fetchAuthenticatedJson<HomeRecord>(homeEndpoint, session, {
      method: "POST",
      headers: createAuthenticatedHeaders(session, {
        contentType: "application/json"
      }),
      body: JSON.stringify(input)
    });
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
    return await fetchAuthenticatedJson<HomeMemberRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/members`,
      session,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session)
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    return listDemoHomeMembers(homeId, session.user.userId);
  }
}

export async function getHomeDashboard(
  session: AuthSession,
  homeId: string
): Promise<HomeDashboardResponse> {
  try {
    return await fetchAuthenticatedJson<HomeDashboardResponse>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/dashboard`,
      session,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session)
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
    return await fetchAuthenticatedJson<HomeShareCodeRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/share-codes`,
      session,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session)
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

    return listDemoHomeShareCodes(homeId, session.user.userId);
  }
}

export async function updateHome(
  session: AuthSession,
  homeId: string,
  input: HomeUpsertInput
): Promise<HomeRecord> {
  try {
    return await fetchAuthenticatedJson<HomeRecord>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}`,
      session,
      {
        method: "PATCH",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json"
        }),
        body: JSON.stringify(input)
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
    return await fetchAuthenticatedJson<HomeShareCodeRecord>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/share-codes`,
      session,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json"
        }),
        body: JSON.stringify(input)
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
    return await fetchAuthenticatedJson<HomeRedeemResponse>(
      `${homeEndpoint}/redeem`,
      session,
      {
        method: "POST",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json"
        }),
        body: JSON.stringify({
          code
        })
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
    return await fetchAuthenticatedJson<HomeMemberRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/members/${encodeURIComponent(userId)}`,
      session,
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
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
    return await fetchAuthenticatedJson<HomeMemberRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/members/${encodeURIComponent(userId)}/access`,
      session,
      {
        method: "PATCH",
        headers: createAuthenticatedHeaders(session, {
          contentType: "application/json"
        }),
        body: JSON.stringify({ allowed })
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
    return await fetchAuthenticatedJson<HomeMemberRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}/members/${encodeURIComponent(userId)}`,
      session,
      {
        method: "DELETE",
        headers: createAuthenticatedHeaders(session)
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
    return await fetchAuthenticatedJson<HomeRecord[]>(
      `${homeEndpoint}/${encodeURIComponent(homeId)}`,
      session,
      {
        method: "DELETE",
        headers: createAuthenticatedHeaders(session)
      }
    );
  } catch (error) {
    if (!shouldUseDemoFallback(error)) {
      throw error;
    }

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
