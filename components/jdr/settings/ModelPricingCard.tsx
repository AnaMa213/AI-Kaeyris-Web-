"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SUMMARY_CLOUD_MODEL_LABELS,
  TRANSCRIPTION_CLOUD_MODEL_LABELS,
} from "@/lib/jdr/schemas/modelSettings";

// Story 6.7 / FR-25 / UX-DR23 (Pricing block). Official DeepInfra prices for the
// catalog cloud models, verified on deepinfra.com (2026-06). Keyed by the exact
// model ids used in TRANSCRIPTION_CLOUD_MODEL_OPTIONS / SUMMARY_CLOUD_MODEL_OPTIONS.
// Transcription is billed per audio minute; LLMs are billed per 1M tokens
// (input and output separately). Prices are indicative and can change upstream.
type TranscriptionPricing = { type: "per-minute"; pricePerMinute: number };
type LlmPricing = {
  type: "per-million-tokens";
  inputPer1M: number;
  outputPer1M: number;
};
type ModelPricing = TranscriptionPricing | LlmPricing;

const CLOUD_MODEL_PRICING: Record<string, ModelPricing> = {
  "openai/whisper-large-v3": { type: "per-minute", pricePerMinute: 0.00045 },
  "openai/whisper-large-v3-turbo": {
    type: "per-minute",
    pricePerMinute: 0.0002,
  },
  "meta-llama/Meta-Llama-3.1-8B-Instruct": {
    type: "per-million-tokens",
    inputPer1M: 0.02,
    outputPer1M: 0.05,
  },
  "meta-llama/Meta-Llama-3.1-70B-Instruct": {
    type: "per-million-tokens",
    inputPer1M: 0.4,
    outputPer1M: 0.4,
  },
  "Qwen/Qwen2.5-72B-Instruct": {
    type: "per-million-tokens",
    inputPer1M: 0.36,
    outputPer1M: 0.4,
  },
};

// Estimation constants for a representative RPG session (documented in the
// disclaimer as approximate). Transcript volume drives LLM input tokens; the
// generated summary is short relative to the transcript.
const WORDS_PER_MINUTE = 100;
const TOKENS_PER_WORD = 1.35;
const OUTPUT_TOKENS_PER_HOUR = 600;

const DEFAULT_SESSION_HOURS = 4;
const MIN_SESSION_HOURS = 0.5;
const MAX_SESSION_HOURS = 24;

// `$` + 3 significant figures, with trailing zeros dropped (e.g. 0.0480 -> $0.048).
function formatUsd(value: number): string {
  return `$${Number(value.toPrecision(3)).toString()}`;
}

function transcriptionCost(pricePerMinute: number, hours: number): number {
  return hours * 60 * pricePerMinute;
}

function summaryCost(
  inputPer1M: number,
  outputPer1M: number,
  hours: number,
): number {
  const inputTokens = hours * 60 * WORDS_PER_MINUTE * TOKENS_PER_WORD;
  const outputTokens = hours * OUTPUT_TOKENS_PER_HOUR;
  return (
    (inputTokens / 1_000_000) * inputPer1M +
    (outputTokens / 1_000_000) * outputPer1M
  );
}

function priceLabel(pricing: ModelPricing): string {
  if (pricing.type === "per-minute") {
    return `${formatUsd(pricing.pricePerMinute)} / min`;
  }
  return `${formatUsd(pricing.inputPer1M)} (entree) · ${formatUsd(
    pricing.outputPer1M,
  )} (sortie) / 1M tokens`;
}

interface PricingRow {
  category: string;
  modelId: string;
  modelLabel: string;
  pricing: ModelPricing | undefined;
}

interface ModelPricingCardProps {
  // null when the corresponding category is not on the Cloud provider.
  transcriptionCloudModel: string | null;
  summaryCloudModel: string | null;
}

export function ModelPricingCard({
  transcriptionCloudModel,
  summaryCloudModel,
}: ModelPricingCardProps) {
  const [sessionHours, setSessionHours] = useState(DEFAULT_SESSION_HOURS);

  const rows: PricingRow[] = [];
  if (transcriptionCloudModel) {
    rows.push({
      category: "Transcription",
      modelId: transcriptionCloudModel,
      modelLabel:
        TRANSCRIPTION_CLOUD_MODEL_LABELS[transcriptionCloudModel] ??
        transcriptionCloudModel,
      pricing: CLOUD_MODEL_PRICING[transcriptionCloudModel],
    });
  }
  if (summaryCloudModel) {
    rows.push({
      category: "LLM Resume",
      modelId: summaryCloudModel,
      modelLabel:
        SUMMARY_CLOUD_MODEL_LABELS[summaryCloudModel] ?? summaryCloudModel,
      pricing: CLOUD_MODEL_PRICING[summaryCloudModel],
    });
  }

  // Cost estimate per category. "—" when the category is not Cloud or the model
  // has no known price.
  const transcriptionPricing = transcriptionCloudModel
    ? CLOUD_MODEL_PRICING[transcriptionCloudModel]
    : undefined;
  const summaryPricing = summaryCloudModel
    ? CLOUD_MODEL_PRICING[summaryCloudModel]
    : undefined;

  const transcriptionEstimate =
    transcriptionPricing?.type === "per-minute"
      ? formatUsd(
          transcriptionCost(transcriptionPricing.pricePerMinute, sessionHours),
        )
      : "—";
  const summaryEstimate =
    summaryPricing?.type === "per-million-tokens"
      ? formatUsd(
          summaryCost(
            summaryPricing.inputPer1M,
            summaryPricing.outputPer1M,
            sessionHours,
          ),
        )
      : "—";

  const handleHoursChange = (raw: string) => {
    const next = Number(raw);
    if (Number.isFinite(next)) {
      setSessionHours(next);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Tarification</CardTitle>
        <CardDescription>
          Prix officiels des modeles cloud configures et estimation du cout
          d&apos;une session.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.category}
              className="flex flex-col gap-0.5 border-b border-foreground/10 pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between"
            >
              <span className="text-sm font-medium">
                {row.category} — {row.modelLabel}
              </span>
              <span className="text-text-chrome-muted text-sm">
                {row.pricing ? priceLabel(row.pricing) : "Tarif inconnu"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="pricing-session-hours">
            Duree de session (heures)
          </Label>
          <Input
            id="pricing-session-hours"
            type="number"
            min={MIN_SESSION_HOURS}
            max={MAX_SESSION_HOURS}
            step={0.5}
            value={sessionHours}
            onChange={(event) => handleHoursChange(event.target.value)}
            className="w-28"
          />
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            Cout estime pour {sessionHours} h
          </p>
          <div className="flex justify-between text-sm">
            <span>Transcription</span>
            <span className="text-text-chrome-muted">
              {transcriptionEstimate}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>LLM Resume</span>
            <span className="text-text-chrome-muted">{summaryEstimate}</span>
          </div>
        </div>

        <p className="text-text-chrome-muted text-xs">
          Les estimations sont approximatives (volume de parole moyen, resume
          court) et les tarifs peuvent varier. Verifie les prix actuels sur
          deepinfra.com.
        </p>
      </CardContent>
    </Card>
  );
}

export type { ModelPricingCardProps };
