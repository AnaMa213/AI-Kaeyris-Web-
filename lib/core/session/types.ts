export type AuthIdentity = {
  authId: string;
  campaignId: string;
};

export type JdrProfile =
  | { role: "gm"; characterId: string; displayName: string }
  | { role: "player"; characterId: string; displayName: string };

export type CurrentUser =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; auth: AuthIdentity; jdr: JdrProfile };

export type AuthMeResponse = {
  user: {
    id: string;
    username: string;
  };
  active_campaign: {
    id: string;
    name: string;
    role: "gm" | "player";
    character_id: string | null;
  } | null;
};
