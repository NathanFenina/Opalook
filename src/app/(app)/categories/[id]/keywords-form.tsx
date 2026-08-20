"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  saveCategoryKeywords,
  suggestKeywordsAction,
  type SuggestionState,
} from "../../actions";
import { Field } from "@/components/app-ui";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
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
          <p className="text-xs font-medium text-muted-foreground">
            Requêtes Search Console de cette URL — clique pour affecter
          </p>
          <ul className="max-h-56 space-y-1 overflow-auto rounded-lg border border-border p-2 ">
            {suggestions.map((item) => {
              const quickWin = item.position >= 8 && item.position <= 20;
              return (
                <li
                  key={item.query}
                  className="flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="break-words">{item.query}</span>
                    <span
                      className={`ml-2 text-xs ${
                        quickWin
                          ? "font-medium text-amber-700 dark:text-amber-400"
                          : "text-muted-foreground/70"
                      }`}
                    >
                      {item.impressions} impr. · pos. {item.position.toFixed(1)}
                      {quickWin && " · gain rapide"}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <Button variant="outline" size="sm" type="button" onClick={() => setKeyword(item.query)}>
                      Principal
                    </Button>
                    <Button variant="outline" size="sm"
                      type="button"
                      onClick={() => setSecondary((c) => appendLine(c, item.query))}
                    >
                      Secondaire
                    </Button>
                    <Button variant="outline" size="sm"
                      type="button"
                      onClick={() => setFanQueries((c) => appendLine(c, item.query))}
                    >
                      Fan query
                    </Button>
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
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-slate-700  dark:text-slate-300"
            }`}
          >
            {ai.message}
          </p>
        )}

        {ai.suggestion && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Mots-clés secondaires proposés
              </p>
              <ul className="space-y-1">
                {ai.suggestion.secondaryKeywords.map((item) => (
                  <li key={item.keyword}>
                    <button
                      type="button"
                      onClick={() => setSecondary((c) => appendLine(c, item.keyword))}
                      className="hover:bg-muted w-full rounded px-2 py-1.5 text-left text-sm transition-colors"
                    >
                      <span className="font-medium">+ {item.keyword}</span>
                      <span className="text-muted-foreground block text-xs">{item.why}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Fan queries proposées
              </p>
              <ul className="space-y-1">
                {ai.suggestion.fanQueries.map((item) => (
                  <li key={item.query}>
                    <button
                      type="button"
                      onClick={() => setFanQueries((c) => appendLine(c, item.query))}
                      className="hover:bg-muted w-full rounded px-2 py-1.5 text-left text-sm transition-colors"
                    >
                      <span className="font-medium">+ {item.query}</span>
                      <span className="text-muted-foreground block text-xs">{item.why}</span>
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
          <Input
            name="target_keyword"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mots-clés secondaires" hint="Un par ligne. Placés dans les intertitres et le corps du texte.">
            <Textarea
              name="secondary_keywords"
              rows={5}
              value={secondary}
              onChange={(event) => setSecondary(event.target.value)}
            />
          </Field>
          <Field label="Fan queries" hint="Un par ligne. Traitées en FAQ ou en section dédiée.">
            <Textarea
              name="fan_queries"
              rows={5}
              value={fanQueries}
              onChange={(event) => setFanQueries(event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Brief opérationnel de la catégorie"
          hint="Ce qui doit impérativement apparaître : arguments commerciaux, contraintes, mentions obligatoires."
        >
          <Textarea
            name="brief"
            rows={4}
            defaultValue={initialBrief}
            placeholder="Ex. : insister sur les quantités minimales, mentionner l'expédition sous 48 h, ne pas parler de prix."
          />
        </Field>

        <Submit label="Valider les mots-clés" pendingLabel="Enregistrement…" />
      </form>
    </div>
  );
}
