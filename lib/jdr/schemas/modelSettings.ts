import { z } from "zod";

export const aiModelProviderSchema = z.enum(["cloud", "local", "ollama"]);

// Local model paths are only meaningful when the corresponding provider is
// "local" (Story 6.3 / FR-23); empty string means "not configured yet".
const localModelPathSchema = z.string().max(1024);

// Cloud model ids are only meaningful when the corresponding provider is
// "cloud" (Story 6.4 / FR-24). Bounded to match the backend column (200).
const cloudModelSchema = z.string().max(200);

// Ollama model name (Story 6.5 / FR-26). Free-text because Ollama models are
// user-installed — a static catalog makes no sense. Only meaningful when the
// LLM Résumé provider is "ollama"; "" means "not configured yet". Bounded to
// match the backend `ollama_model` column (200).
const ollamaModelSchema = z.string().max(200);

// DeepInfra cloud model catalogs (Story 6.4 / FR-24). Ids must stay exact and
// stable — Story 6.5's pricing table keys off them. Defaults (first entry of
// each list) mirror the backend defaults in
// `d:/Projets/dev/AI-Kaeyris/app/core/config.py`.
export const TRANSCRIPTION_CLOUD_MODEL_OPTIONS = [
  { value: "openai/whisper-large-v3", label: "Whisper Large v3" },
  { value: "openai/whisper-large-v3-turbo", label: "Whisper Large v3 Turbo" },
] as const;

export const SUMMARY_CLOUD_MODEL_OPTIONS = [
  {
    value: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    label: "Llama 3.1 8B Instruct",
  },
  {
    value: "meta-llama/Meta-Llama-3.1-70B-Instruct",
    label: "Llama 3.1 70B Instruct",
  },
  { value: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5 72B Instruct" },
] as const;

// `Record<value, label>` forms for the `<Select items=…>` prop, mirroring the
// `PROVIDER_LABELS` shape used by the existing provider selectors.
export const TRANSCRIPTION_CLOUD_MODEL_LABELS: Record<string, string> =
  Object.fromEntries(
    TRANSCRIPTION_CLOUD_MODEL_OPTIONS.map((o) => [o.value, o.label]),
  );
export const SUMMARY_CLOUD_MODEL_LABELS: Record<string, string> =
  Object.fromEntries(
    SUMMARY_CLOUD_MODEL_OPTIONS.map((o) => [o.value, o.label]),
  );

export const DEFAULT_TRANSCRIPTION_CLOUD_MODEL =
  TRANSCRIPTION_CLOUD_MODEL_OPTIONS[0].value;
export const DEFAULT_SUMMARY_CLOUD_MODEL = SUMMARY_CLOUD_MODEL_OPTIONS[0].value;

export const modelSettingsSchema = z.object({
  transcriptionProvider: aiModelProviderSchema,
  summaryProvider: aiModelProviderSchema,
  transcriptionLocalPath: localModelPathSchema,
  summaryLocalPath: localModelPathSchema,
  transcriptionCloudModel: cloudModelSchema,
  summaryCloudModel: cloudModelSchema,
  // Ollama model name for the LLM Résumé provider (Story 6.5 / FR-26).
  ollamaModel: ollamaModelSchema,
  // A NEW DeepInfra key being entered; "" means "no change / keep existing".
  deepinfraApiKey: z.string().max(256),
  // Read-only, server-derived: whether a key is already stored.
  deepinfraApiKeySet: z.boolean(),
});

export const modelSettingsPatchSchema = modelSettingsSchema.partial().extend({
  // Backend-issued validation proofs (Story 6.6 / BD-20). These are write-only
  // PATCH fields: they are NOT part of ModelSettingsOut, so they live on the
  // patch schema only, never on the form/read schema. The backend rejects a
  // changed Local path unless the matching proof is supplied and still valid.
  transcriptionLocalValidationId: z.string().optional(),
  summaryLocalValidationId: z.string().optional(),
});

export type AiModelProvider = z.infer<typeof aiModelProviderSchema>;
export type ModelSettings = z.infer<typeof modelSettingsSchema>;
export type ModelSettingsPatchInput = z.infer<typeof modelSettingsPatchSchema>;

// --- Local model validation (Story 6.6 / BD-20) --------------------------

// A Local model is validated per category before it can be saved.
export const localModelCategorySchema = z.enum(["transcription", "summary"]);
export type LocalModelCategory = z.infer<typeof localModelCategorySchema>;

// Camel-cased projection of the backend `LocalModelValidationOut` proof. The
// only status the backend ever emits on a 2xx is "succeeded"; failures arrive
// as Problem Details (handled via ApiError, not this shape).
export const localModelValidationResultSchema = z.object({
  validationId: z.string(),
  category: localModelCategorySchema,
  modelPath: z.string(),
  status: z.literal("succeeded"),
  runtime: z.string(),
  modelFormat: z.string(),
  message: z.string(),
  expiresAt: z.string(),
});
export type LocalModelValidationResult = z.infer<
  typeof localModelValidationResultSchema
>;

// Proofs forwarded to the PATCH body, one optional `validation_id` per Local
// category. Empty/absent when the matching Local path did not change.
export interface LocalModelValidationProofs {
  transcription?: string;
  summary?: string;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  transcriptionProvider: "cloud",
  summaryProvider: "cloud",
  transcriptionLocalPath: "",
  summaryLocalPath: "",
  transcriptionCloudModel: DEFAULT_TRANSCRIPTION_CLOUD_MODEL,
  summaryCloudModel: DEFAULT_SUMMARY_CLOUD_MODEL,
  ollamaModel: "",
  deepinfraApiKey: "",
  deepinfraApiKeySet: false,
};
