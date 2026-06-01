export type SystemRole = "admin" | "user";
export type CampaignRole = "gm" | "pj";

export type AuthIdentity = {
  authId: string;
  username: string;
  systemRole: SystemRole;
};

export type ActiveCampaign = {
  id: string;
  name: string;
  role: CampaignRole;
  characterId: string | null;
};

export type CurrentUser =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | {
      status: "authenticated";
      auth: AuthIdentity;
      activeCampaign: ActiveCampaign | null;
    };

export type AuthMeResponse = {
  user: {
    id: string;
    username: string;
    system_role: SystemRole;
  };
  active_campaign: {
    id: string;
    name: string;
    role: CampaignRole;
    character_id: string | null;
  } | null;
};
