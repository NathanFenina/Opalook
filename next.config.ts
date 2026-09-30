import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * L'export de catalogue est un gros fichier, et c'est normal.
       *
       * 188 catégories dans dix langues, descriptions HTML comprises, font
       * 2,3 Mo. La limite par défaut d'une Server Action est de 1 Mo : la
       * requête est refusée avant même d'entrer dans le code, donc sans message
       * exploitable — l'écran affiche « A server error occurred » et rien dans
       * les journaux applicatifs.
       *
       * 4 Mo laisse de la marge pour un catalogue qui grossit, tout en restant
       * sous le plafond de 4,5 Mo qu'impose Vercel sur le corps d'une requête.
       * Au-delà, ce n'est plus un réglage qu'il faut mais un dépôt de fichier
       * séparé — le formulaire prévient avant l'envoi plutôt que de laisser la
       * requête mourir en silence.
       */
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
