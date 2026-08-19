"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  saveCategoryKeywords,
  suggestKeywordsAction,
  type SuggestionState,
} from "../../actions";
import { buttonClass, inputClass, Field, secondaryButtonClass } from "@/components/ui";

export type GscQuery = {
  query: string;
  impressions: number;
  position: number;
  clicks?: number;
};

const SUGGEST_INITIAL: SuggestionState = { status: "idle", message: "" };

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function appendLine(current: string, value: string): string {
  const lines = current
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.some((line) => line.toLowerCase() === value.toLowerCase())) return current;
  return [...lines, value].join("\n");
}

/**
 * Pilote toute la rédaction : mot-clé principal, secondaires, fan queries, brief.
 *
 * Les propositions viennent de deux sources qu'on ne mélange pas : les requêtes
 * réellement remontées par Search Console (de la demande constatée) et les
 * suggestions du modèle à partir des produits et des filtres de la page (du
 * champ sémantique déduit). Dans les deux cas, rien n'est appliqué sans clic.
 */
export function KeywordsForm({
  categoryId,
  initialKeyword,
  initialSecondary,
  initialFanQueries,
  initialBrief,
  suggestions,
}: {
  categoryId: string;
  initialKeyword: string;
  initialSecondary: string[];
  initialFanQueries: string[];
  initialBrief: string;
  suggestions: GscQuery[];
}) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [secondary, setSecondary] = useState(initialSecondary.join("\n"));
  const [fanQueries, setFanQueries] = useState(initialFanQueries.join("\n"));
  const [ai, suggestAction] = useActionState(suggestKeywordsAction, SUGGEST_INITIAL);

  return (
    <div className="space-y-6">
      {/* Requêtes GSC — demande constatée */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Requêtes Search Console de cette URL — clique pour affecter
          </p>
          <ul className="max-h-56 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
            {suggestions.map((item) => {
              const quickWin = item.position >= 8 && item.position <= 20;
              return (
                <li
                  key={item.query}
                  className="flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="min-w-0">
                    <span className="break-words">{item.query}</span>
                    <span
                      className={`ml-2 text-xs ${
                        quickWin
                          ? "font-medium text-amber-700 dark:text-amber-400"
                          : "text-slate-400"
                      }`}
                    >
                      {item.impressions} impr. · pos. {item.position.toFixed(1)}
                      {quickWin && " · gain rapide"}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <button type="button" className={secondaryButtonClass} onClick={() => setKeyword(item.query)}>
                      Principal
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => setSecondary((c) => appendLine(c, item.query))}
                    >
                      Secondaire
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => setFanQueries((c) => appendLine(c, item.query))}
                    >
                      Fan query
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Suggestions du modèle — champ sémantique déduit de la page */}
      <form action={suggestAction} className="space-y-3">
        <input type="hidden" name="category_id" value={categoryId} />
        <Submit label="Proposer des mots-clés" pendingLabel="Analyse de la page…" />

        {ai.status !== "idle" && (
          <p
            role="status"
            className={`rounded-lg px-3 py-2 text-sm ${
              ai.status === "error"
                ? "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {ai.message}
          </p>
        )}

        {ai.suggestion && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Mots-clés secondaires proposés
              </p>
              <ul className="space-y-1">
                {ai.suggestion.secondaryKeywords.map((item) => (
                  <li key={item.keyword}>
                    <button
                      type="button"
                      onClick={() => setSecondary((c) => appendLine(c, item.keyword))}
                      className="w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="font-medium">+ {item.keyword}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {item.why}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Fan queries proposées
              </p>
              <ul className="space-y-1">
                {ai.suggestion.fanQueries.map((item) => (
                  <li key={item.query}>
                    <button
                      type="button"
                      onClick={() => setFanQueries((c) => appendLine(c, item.query))}
                      className="w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="font-medium">+ {item.query}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {item.why}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </form>

      <form action={saveCategoryKeywords} className="space-y-5">
        <input type="hidden" name="category_id" value={categoryId} />

        <Field
          label="Mot-clé principal"
          hint="Un seul par catégorie sur tout le projet — l'app refuse un doublon."
        >
          <input
            name="target_keyword"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mots-clés secondaires" hint="Un par ligne. Placés dans les intertitres et le corps du texte.">
            <textarea
              name="secondary_keywords"
              rows={5}
              value={secondary}
              onChange={(event) => setSecondary(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Fan queries" hint="Un par ligne. Traitées en FAQ ou en section dédiée.">
            <textarea
              name="fan_queries"
              rows={5}
              value={fanQueries}
              onChange={(event) => setFanQueries(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label="Brief opérationnel de la catégorie"
          hint="Ce qui doit impérativement apparaître : arguments commerciaux, contraintes, mentions obligatoires."
        >
          <textarea
            name="brief"
            rows={4}
            defaultValue={initialBrief}
            placeholder="Ex. : insister sur les quantités minimales, mentionner l'expédition sous 48 h, ne pas parler de prix."
            className={inputClass}
          />
        </Field>

        <Submit label="Valider les mots-clés" pendingLabel="Enregistrement…" />
      </form>
    </div>
  );
}
