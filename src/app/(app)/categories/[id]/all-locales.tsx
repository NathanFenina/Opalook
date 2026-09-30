"use client";

/**
 * Traiter une catégorie dans toutes ses langues, d'une seule commande.
 *
 * Pourquoi le pilotage est ici, côté navigateur, et pas dans une action qui
 * ferait tout : une rédaction prend deux à trois minutes, une fonction Vercel
 * s'arrête à cinq. Dix langues en un seul appel mourraient à la troisième, et
 * on ne saurait même pas laquelle a abouti. On envoie donc une requête par
 * étape et par langue, séquentiellement, et chaque étape terminée est un acquis
 * enregistré en base.
 *
 * Conséquence directe, et voulue : on peut fermer l'onglet. Ce qui est fait est
 * fait, et relancer reprend là où ça s'était arrêté — une langue qui a déjà son
 * mot-clé ne le refait pas, une langue déjà rédigée est sautée sauf demande
 * explicite.
 */

import { useState, useTransition } from "react";

import {
  bulkPickKeyword,
  measureTargetLengthAction,
  runDescriptionPhase,
  runMetadataPhase,
} from "../../locale-actions";
import { localeLabel } from "@/lib/locales";
import { Button } from "@/components/ui/button";

type EtapeNom = "Mot-clé" | "Balises" | "Longueur cible" | "Rédaction";

type Ligne = {
  locale: string;
  etat: "attente" | "encours" | "fini" | "erreur" | "sautee";
  etape: EtapeNom | null;
  message: string;
};

/** État d'une langue avant lancement, tel que la page le connaît. */
export type LocaleEtat = {
  locale: string;
  aMotCle: boolean;
  aLongueur: boolean;
  aVersion: boolean;
};

const ETAPES: EtapeNom[] = ["Mot-clé", "Balises", "Longueur cible", "Rédaction"];

const TON: Record<Ligne["etat"], string> = {
  attente: "text-muted-foreground/60",
  encours: "text-amber-700 dark:text-amber-400",
  fini: "text-emerald-700 dark:text-emerald-400",
  erreur: "text-destructive",
  sautee: "text-muted-foreground",
};

const MARQUE: Record<Ligne["etat"], string> = {
  attente: "○",
  encours: "◐",
  fini: "✓",
  erreur: "✗",
  sautee: "–",
};

export function AllLocalesRunner({
  categoryId,
  etats,
}: {
  categoryId: string;
  etats: LocaleEtat[];
}) {
  const [choisies, setChoisies] = useState<string[]>(etats.map((etat) => etat.locale));
  const [refaire, setRefaire] = useState(false);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [enCours, startTransition] = useTransition();

  const majLigne = (locale: string, patch: Partial<Ligne>) =>
    setLignes((actuelles) =>
      actuelles.map((ligne) => (ligne.locale === locale ? { ...ligne, ...patch } : ligne)),
    );

  async function lancer() {
    const aTraiter = etats.filter((etat) => choisies.includes(etat.locale));

    setLignes(
      aTraiter.map((etat) => ({
        locale: etat.locale,
        etat: "attente" as const,
        etape: null,
        message: "",
      })),
    );

    for (const etat of aTraiter) {
      // Une langue déjà rédigée n'est pas refaite sans demande : la relance doit
      // rester bon marché, sinon personne ne la relance.
      if (etat.aVersion && !refaire) {
        majLigne(etat.locale, {
          etat: "sautee",
          message: "Déjà rédigée. Coche « refaire » pour la regénérer.",
        });
        continue;
      }

      let echoue = false;

      for (const etape of ETAPES) {
        if (echoue) break;
        if (etape === "Longueur cible" && etat.aLongueur && !refaire) continue;

        majLigne(etat.locale, { etat: "encours", etape, message: "en cours…" });

        const formData = new FormData();
        formData.set("category_id", categoryId);
        formData.set("locale", etat.locale);

        try {
          let resultat: { status: string; message: string };

          if (etape === "Mot-clé") {
            resultat = await bulkPickKeyword({ status: "idle", message: "" }, formData);
          } else if (etape === "Balises") {
            resultat = await runMetadataPhase({ status: "idle", message: "" }, formData);
          } else if (etape === "Longueur cible") {
            resultat = await measureTargetLengthAction(
              { status: "idle", message: "" },
              formData,
            );
            // Un top 10 illisible n'empêche pas d'écrire : on note et on continue
            // avec la fourchette générale.
            if (resultat.status === "error") {
              majLigne(etat.locale, { message: `Longueur non mesurée — ${resultat.message}` });
              continue;
            }
          } else {
            formData.set("use_metadata", "1");
            resultat = await runDescriptionPhase({ status: "idle", message: "" }, formData);
          }

          if (resultat.status === "error") {
            majLigne(etat.locale, {
              etat: "erreur",
              etape,
              message: `${etape} — ${resultat.message}`,
            });
            echoue = true;
          } else {
            majLigne(etat.locale, { message: resultat.message });
          }
        } catch (error) {
          majLigne(etat.locale, {
            etat: "erreur",
            etape,
            message: `${etape} — ${(error as Error).message}`,
          });
          echoue = true;
        }
      }

      if (!echoue) majLigne(etat.locale, { etat: "fini", etape: null });
    }
  }

  const restantes = etats.filter((etat) => !etat.aVersion).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {etats.map((etat) => {
          const active = choisies.includes(etat.locale);
          return (
            <button
              key={etat.locale}
              type="button"
              disabled={enCours}
              onClick={() =>
                setChoisies((actuelles) =>
                  active
                    ? actuelles.filter((code) => code !== etat.locale)
                    : [...actuelles, etat.locale],
                )
              }
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "border-foreground/30 bg-muted font-medium"
                  : "border-transparent text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {localeLabel(etat.locale)}
              {etat.aVersion && <span className="ml-1.5 text-emerald-700 dark:text-emerald-400">✓</span>}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={refaire}
          disabled={enCours}
          onChange={(event) => setRefaire(event.target.checked)}
        />
        <span className="text-muted-foreground">
          Refaire les langues déjà rédigées ({etats.length - restantes} concernée
          {etats.length - restantes > 1 ? "s" : ""})
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={enCours || choisies.length === 0}
          onClick={() => startTransition(lancer)}
        >
          {enCours
            ? "Traitement en cours…"
            : `Lancer ${choisies.length} langue${choisies.length > 1 ? "s" : ""}`}
        </Button>
        <span className="text-xs text-muted-foreground">
          Compter deux à trois minutes par langue. L&apos;onglet peut être fermé : chaque
          étape terminée est enregistrée, et relancer reprend où ça s&apos;était arrêté.
        </span>
      </div>

      {lignes.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {lignes.map((ligne) => (
            <li key={ligne.locale} className="flex gap-2">
              <span className={`w-4 shrink-0 ${TON[ligne.etat]}`} aria-hidden>
                {MARQUE[ligne.etat]}
              </span>
              <span className="w-28 shrink-0 font-medium">{localeLabel(ligne.locale)}</span>
              <span className="min-w-0 flex-1">
                {ligne.etape && ligne.etat === "encours" && (
                  <span className={TON.encours}>{ligne.etape} · </span>
                )}
                <span className={ligne.etat === "erreur" ? TON.erreur : "text-muted-foreground"}>
                  {ligne.message || "en attente"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {enCours && (
        <p className="text-xs text-muted-foreground">
          Ne recharge pas la page pendant le traitement : la langue en cours serait
          interrompue au milieu de son étape. Les précédentes, elles, sont déjà acquises.
        </p>
      )}
    </div>
  );
}
