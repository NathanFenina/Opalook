"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { saveCategoryKeywords } from "../../actions";
import { buttonClass, inputClass, Field, secondaryButtonClass } from "@/components/ui";

export type GscQuery = {
  query: string;
  impressions: number;
  position: number;
  clicks?: number;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Enregistrement…" : "Valider les mots-clés"}
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
 * Validation des mots-clés à partir des requêtes réellement remontées par GSC.
 * Les suggestions sont triées par impressions : les positions 8 à 20 sont les
 * gains les plus rapides, on les signale visuellement.
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

  return (
    <form action={saveCategoryKeywords} className="space-y-5">
      <input type="hidden" name="category_id" value={categoryId} />

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Requêtes Search Console pour cette URL — clique pour affecter
          </p>
          <ul className="max-h-64 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
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
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => setKeyword(item.query)}
                    >
                      Principal
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => setSecondary((current) => appendLine(current, item.query))}
                    >
                      Secondaire
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => setFanQueries((current) => appendLine(current, item.query))}
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
          placeholder="Ex. : insister sur les quantités minimales de commande, mentionner l'expédition sous 48 h, ne pas parler de prix."
          className={inputClass}
        />
      </Field>

      <Submit />
    </form>
  );
}
