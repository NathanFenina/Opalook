"use client";

/**
 * Phase 1 : ce qui se décide avant d'écrire une ligne de texte.
 *
 * Trois formulaires dans l'ordre où ils se font, et pas dans un autre : le
 * mot-clé cadre les balises, les balises cadrent le texte, et la longueur cible
 * dit combien il en faut. Chacun s'arrête là où le suivant commence, pour qu'on
 * puisse revenir sur l'un sans défaire les autres — c'est précisément ce qui
 * permet de retoucher une URL sans regénérer sept mille caractères.
 */

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  applyKeyword,
  measureTargetLengthAction,
  proposeKeyword,
  runMetadataPhase,
  saveMetadata,
  type KeywordProposalState,
  type MetadataState,
  type TargetLengthState,
} from "../../locale-actions";
import { Field } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Notice({
  status,
  children,
}: {
  status: "idle" | "ok" | "error";
  children: React.ReactNode;
}) {
  if (status === "idle") return null;
  return (
    <p
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ${
        status === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-slate-700 dark:text-slate-300"
      }`}
    >
      {children}
    </p>
  );
}

function Num({ value, suffix }: { value: number | null; suffix?: string }) {
  return (
    <span className="tabular-nums">
      {value === null ? "—" : value.toLocaleString("fr-FR")}
      {value !== null && suffix ? ` ${suffix}` : ""}
    </span>
  );
}

/* ------------------------------------ 1. proposer le mot-clé principal --- */

const PROPOSAL_INITIAL: KeywordProposalState = { status: "idle", message: "" };

/**
 * Le bouton demandé : propose le mot-clé principal à partir des données.
 *
 * Le classement est affiché avec ce qui l'a produit — volume, difficulté,
 * position acquise — parce qu'un classement dont on ne voit pas les entrées ne
 * se discute pas, et qu'on ne confie pas le cadrage de cent quatre-vingts pages
 * à un chiffre opaque.
 */
export function KeywordProposal({
  categoryId,
  locale,
  currentKeyword,
}: {
  categoryId: string;
  locale: string;
  currentKeyword: string | null;
}) {
  const [state, action] = useActionState(proposeKeyword, PROPOSAL_INITIAL);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="category_id" value={categoryId} />
        <input type="hidden" name="locale" value={locale} />
        <Submit
          label="Proposer le mot-clé principal"
          pendingLabel="Analyse et mesure des volumes…"
        />
        <Notice status={state.status}>{state.message}</Notice>
      </form>

      {state.avertissements && state.avertissements.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {state.avertissements.map((avertissement) => (
            <li key={avertissement}>{avertissement}</li>
          ))}
        </ul>
      )}

      {state.candidates && state.candidates.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Candidat</th>
                <th className="px-3 py-2 text-right font-medium">Volume</th>
                <th className="px-3 py-2 text-right font-medium">KD</th>
                <th className="px-3 py-2 text-right font-medium">Position</th>
                <th className="px-3 py-2 text-right font-medium">Note</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {state.candidates.map((candidate, index) => {
                const retenu =
                  currentKeyword?.toLowerCase() === candidate.keyword.toLowerCase();
                return (
                  <tr
                    key={candidate.keyword}
                    className={`border-t ${index === 0 ? "bg-emerald-500/5" : ""}`}
                  >
                    <td className="max-w-[20rem] px-3 py-2">
                      <span className="font-medium">{candidate.keyword}</span>
                      {index === 0 && (
                        <span className="ml-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          recommandé
                        </span>
                      )}
                      {retenu && (
                        <span className="ml-2 text-xs text-muted-foreground">actuel</span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {candidate.source} · {candidate.why}
                      </span>
                      {candidate.marketIntent?.toLowerCase().includes("hors") && (
                        <span className="block text-xs text-destructive">
                          Public hors marché : cette requête n&apos;est pas tapée par les
                          acheteurs du site.
                        </span>
                      )}
                      {candidate.reservation &&
                        candidate.reservation.toLowerCase() !== "aucun" && (
                          <span className="block text-xs text-amber-700 dark:text-amber-400">
                            Chevauchement : {candidate.reservation}
                          </span>
                        )}
                      <span className="block text-xs text-muted-foreground/70">
                        {candidate.verdict}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Num value={candidate.volume} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Num value={candidate.difficulty} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {candidate.position === null ? (
                        "—"
                      ) : (
                        <span
                          className={
                            candidate.position >= 11 && candidate.position <= 20
                              ? "font-medium text-amber-700 dark:text-amber-400"
                              : ""
                          }
                        >
                          {candidate.position.toFixed(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {candidate.score}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <form action={applyKeyword}>
                        <input type="hidden" name="category_id" value={categoryId} />
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="keyword" value={candidate.keyword} />
                        <input
                          type="hidden"
                          name="volume"
                          value={candidate.volume ?? ""}
                        />
                        <input
                          type="hidden"
                          name="difficulty"
                          value={candidate.difficulty ?? ""}
                        />
                        <Button variant="outline" size="sm" type="submit" disabled={retenu}>
                          {retenu ? "Retenu" : "Retenir"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------ 2. balises et segment d'URL -------- */

const METADATA_INITIAL: MetadataState = { status: "idle", message: "" };

/**
 * Les balises et l'URL, proposées puis corrigées puis validées.
 *
 * La validation n'est pas un bouton de confort : une fois cochée, la rédaction
 * recopie ces balises au lieu d'en inventer d'autres. C'est ce qui fait qu'on
 * peut relancer un texte dix fois sans que le title bouge.
 */
export function MetadataForm({
  categoryId,
  locale,
  initial,
}: {
  categoryId: string;
  locale: string;
  initial: {
    title: string;
    metaDescription: string;
    h1: string;
    linkRewrite: string;
    approved: boolean;
    generatedAt: string | null;
  };
}) {
  const [state, action] = useActionState(runMetadataPhase, METADATA_INITIAL);

  const [title, setTitle] = useState(initial.title);
  const [meta, setMeta] = useState(initial.metaDescription);
  const [h1, setH1] = useState(initial.h1);
  const [link, setLink] = useState(initial.linkRewrite);

  // Une proposition fraîche remplace ce qu'il y avait à l'écran : c'est ce qu'on
  // vient de demander. Ce qui a été enregistré reste récupérable par un
  // rechargement de page.
  const proposal = state.proposal;
  const applied = proposal
    ? {
        title: proposal.title,
        meta: proposal.metaDescription,
        h1: proposal.h1,
        link: proposal.linkRewrite,
      }
    : null;

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-3">
        <input type="hidden" name="category_id" value={categoryId} />
        <input type="hidden" name="locale" value={locale} />
        <Submit
          label={initial.generatedAt ? "Reproposer les balises" : "Proposer les balises"}
          pendingLabel="Rédaction des balises…"
        />
        <Notice status={state.status}>{state.message}</Notice>
        {proposal && (
          <p className="text-xs text-muted-foreground">{proposal.rationale}</p>
        )}
      </form>

      <form action={saveMetadata} className="space-y-4">
        <input type="hidden" name="category_id" value={categoryId} />
        <input type="hidden" name="locale" value={locale} />

        <Field label={`Title — ${(applied?.title ?? title).length} caractères`}>
          <Input
            name="title"
            value={applied?.title ?? title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field
          label={`Meta description — ${(applied?.meta ?? meta).length} caractères`}
          hint="Au-delà de 158, Google tronque."
        >
          <Textarea
            name="meta_description"
            rows={3}
            value={applied?.meta ?? meta}
            onChange={(event) => setMeta(event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`H1 — ${(applied?.h1 ?? h1).length} caractères`}>
            <Input
              name="h1"
              value={applied?.h1 ?? h1}
              onChange={(event) => setH1(event.target.value)}
            />
          </Field>
          <Field
            label="Segment d'URL"
            hint="Normalisé à l'enregistrement : minuscules, sans accent, tirets. Le changer demande une redirection."
          >
            <Input
              name="link_rewrite"
              value={applied?.link ?? link}
              onChange={(event) => setLink(event.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="approved"
            defaultChecked={initial.approved}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Balises validées.</span>{" "}
            <span className="text-muted-foreground">
              Cochée, la rédaction les reprend à l&apos;identique au lieu d&apos;en
              proposer d&apos;autres.
            </span>
          </span>
        </label>

        <Submit label="Enregistrer les balises et l'URL" pendingLabel="Enregistrement…" />
      </form>
    </div>
  );
}

/* ------------------------------------ 3. longueur cible ------------------ */

const LENGTH_INITIAL: TargetLengthState = { status: "idle", message: "" };

/**
 * La longueur à viser, relevée sur le top 10 réel.
 *
 * Le détail page par page est montré, y compris les échecs de lecture : une
 * médiane calculée sur quatre pages sur dix n'a pas la même valeur qu'une
 * médiane sur dix, et cacher l'écart reviendrait à présenter une estimation
 * comme une mesure.
 */
export function TargetLengthForm({
  categoryId,
  locale,
  current,
  measuredAt,
}: {
  categoryId: string;
  locale: string;
  current: number | null;
  measuredAt: string | null;
}) {
  const [state, action] = useActionState(measureTargetLengthAction, LENGTH_INITIAL);
  const mesure = state.mesure;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-2xl font-semibold tabular-nums">
          {current ? current.toLocaleString("fr-FR") : "—"}
        </span>
        <span className="text-sm text-muted-foreground">
          caractères visés
          {measuredAt
            ? ` · relevé le ${new Date(measuredAt).toLocaleDateString("fr-FR")}`
            : " · pas encore mesuré"}
        </span>
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="category_id" value={categoryId} />
        <input type="hidden" name="locale" value={locale} />
        <Submit
          label="Mesurer sur le top 10"
          pendingLabel="Lecture des dix concurrents…"
        />
        <Notice status={state.status}>{state.message}</Notice>
      </form>

      {mesure && mesure.sujets && mesure.sujets.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Ce que traite le top 10 — le socle que la rédaction doit couvrir
          </p>
          <ul className="space-y-0.5 text-xs">
            {mesure.sujets.map((sujet) => (
              <li key={sujet.titre} className="flex gap-2">
                <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground/70">
                  {sujet.pages}/10
                </span>
                <span className="min-w-0">{sujet.titre}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground/80 text-xs">
            Relevé sur les intertitres des pages classées. Ces sujets sont passés à la
            rédaction, à couvrir dans l&apos;angle de la catégorie — pas à recopier.
          </p>
        </div>
      )}

      {mesure && (
        <div className="space-y-2">
          <ol className="space-y-1 text-xs">
            {mesure.pages.map((page) => (
              <li key={page.url} className="flex gap-2">
                <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground/70">
                  {page.rank}
                </span>
                <span className="min-w-0 flex-1 truncate">{page.domain}</span>
                <span className="shrink-0 tabular-nums">
                  {page.length === null
                    ? `illisible — ${page.raison}`
                    : `${page.length.toLocaleString("fr-FR")} car.`}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground/80">{mesure.reserve}</p>
        </div>
      )}
    </div>
  );
}
