import { apiRequest } from "@/services/api";

export interface UserPreferences {
  country: string | null;
  timezone: string | null;
  daw_preference: string | null;
  plugin_preference: string | null;
  theme: "dark" | "system" | null;
  language: string | null;
  default_bpm: number | null;
  default_key: string | null;
  default_genre: string | null;
  auto_save: boolean | null;
  autosave_interval_seconds: number | null;
  prompt_history_enabled: boolean | null;
  notification_settings: Record<string, boolean> | null;
}

export interface AccountProfile {
  id: string;
  email?: string | null;
  display_name: string | null;
  avatar_path: string | null;
  membership_type?: string | null;
  membership_status?: string | null;
  created_at?: string | null;
  user_preferences?: UserPreferences | UserPreferences[] | null;
}

export interface AccountProfileResponse extends AccountProfile {
  preferences: UserPreferences;
}

const defaultPreferences: UserPreferences = {
  country: null,
  timezone: null,
  daw_preference: null,
  plugin_preference: null,
  theme: "system",
  language: "en",
  default_bpm: 120,
  default_key: null,
  default_genre: null,
  auto_save: true,
  autosave_interval_seconds: 60,
  prompt_history_enabled: true,
  notification_settings: {
    productUpdates: true,
    billing: true,
    support: true,
  },
};

function normalizePreferences(value: AccountProfile["user_preferences"]): UserPreferences {
  const raw = Array.isArray(value) ? value[0] : value;
  return {
    ...defaultPreferences,
    ...(raw ?? {}),
    notification_settings: {
      ...defaultPreferences.notification_settings,
      ...(raw?.notification_settings ?? {}),
    },
  };
}

export const accountApi = {
  async profile() {
    const response = await apiRequest<{ data: AccountProfile }>("/account/profile");
    return {
      data: {
        ...response.data,
        preferences: normalizePreferences(response.data.user_preferences),
      } satisfies AccountProfileResponse,
    };
  },

  updateProfile(input: { displayName: string; avatarPath?: string | null }) {
    return apiRequest<{ data: AccountProfile }>("/account/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  updatePreferences(input: {
    country?: string | null;
    timezone?: string | null;
    dawPreference?: string | null;
    pluginPreference?: string | null;
    theme?: "dark" | "system";
    language?: string;
    defaultBpm?: number;
    defaultKey?: string;
    defaultGenre?: string | null;
    autoSave?: boolean;
    autosaveIntervalSeconds?: number;
    promptHistoryEnabled?: boolean;
    notificationSettings?: Record<string, boolean>;
  }) {
    return apiRequest<{ data: UserPreferences }>("/account/preferences", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export { defaultPreferences };