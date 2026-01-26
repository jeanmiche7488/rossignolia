'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface KpiInfoDialogProps {
  kpiType: 'gain' | 'economie';
  triggerClassName?: string;
}

const kpiInfo = {
  gain: {
    title: 'Gain : Chiffre d\'Affaires Sécurisé',
    subtitle: 'Revenue Protected',
    description: 'C\'est l\'indicateur qui montre combien d\'argent vous avez aidé le client à gagner (ou à ne pas perdre).',
    logic: 'Votre outil a détecté un risque de rupture de stock imminent sur un produit qui se vend bien et a envoyé une alerte/recommandation de réapprovisionnement. Le client a suivi la recommandation.',
    measurement: 'Le volume de ventes réalisé sur ces produits pendant la période où ils auraient dû être en rupture sans votre intervention.',
    example: 'Grâce à nos alertes d\'anticipation, vous avez sauvé 50 000 € de ventes ce mois-ci qui auraient été perdues en ruptures.',
  },
  economie: {
    title: 'Économie : Réduction du Surstock / Cash Libéré',
    subtitle: 'Capital Released',
    description: 'C\'est l\'indicateur qui montre combien d\'argent vous avez aidé le client à économiser.',
    logic: 'Votre outil a identifié des produits où le stock était trop élevé par rapport à la demande réelle (prévisions) et a recommandé de baisser les commandes fournisseurs ou de faire une promo pour écouler.',
    measurement: 'La valeur financière du stock inutile que vous avez permis d\'éviter. On peut aller plus loin en calculant l\'économie sur les "coûts de possession" (stockage, assurance, dépréciation - souvent estimés à 15-20% de la valeur du stock par an).',
    example: 'En suivant nos recommandations de baisse de stock sur les produits "dormants", vous avez libéré 20 000 € de trésorerie et économisé 3 000 € de frais de stockage.',
  },
};

export function KpiInfoDialog({ kpiType, triggerClassName }: KpiInfoDialogProps) {
  const [open, setOpen] = useState(false);
  const info = kpiInfo[kpiType];

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-5 w-5 p-0 hover:bg-transparent', triggerClassName)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Info className="h-4 w-4 text-slate-400 hover:text-slate-600" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">{info.title}</DialogTitle>
            <DialogDescription className="text-sm font-medium text-blue-600 mt-1">
              {info.subtitle}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 text-slate-900">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Description</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{info.description}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Logique</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{info.logic}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Ce que ça mesure</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{info.measurement}</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Exemple de message client</h4>
              <p className="text-sm text-blue-800 italic leading-relaxed">"{info.example}"</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
