# Facturation Facile - Devis & Factures

Une application web locale, autonome et 100% sans serveur, conçue pour générer, éditer, gérer et exporter des devis et des factures au format A4 avec une fidélité graphique absolue.

---

## 🌟 Fonctionnalités Principales

- **100% Local & Sans Serveur** :
  - Fonctionne par simple double-clic sur `index.html` dans n'importe quel navigateur (Chrome, Edge, Firefox, Safari).
  - Aucune installation de Node.js, PHP, Python ou serveur web requise.
  - Fonctionne même hors ligne (les librairies de génération PDF sont intégrées localement dans `js/vendor/`).
- **Sauvegarde Automatique Continue** :
  - Toutes vos modifications sont enregistrées en temps réel dans le stockage local de votre navigateur (`localStorage`).
  - Système d'export / import de sauvegarde au format `JSON` (accessible via l'icône 💾) pour archiver ou transférer facilement vos données sur un autre ordinateur.
- **Conformité Graphique Exacte & Édition Intégrale** :
  - Rendu A4 fidèle aux modèles originaux (bandeaux noirs d'en-tête, totaux avec pointillés, tableau bancaire RIB, mentions légales, clauses sur-mesure).
  - Tous les textes, intitulés, montants, pourcentages et colonnes sont éditables directement sur la feuille.
  - Ajout / suppression illimité de lignes de prestations avec calculs mathématiques en direct (prise en compte des acomptes déduits et montants négatifs).
- **Indicateur Visuel de Date d'Émission** :
  - En mode édition, un badge discret `⚠️ ≠ [Date du jour]` apparaît automatiquement si la date d'émission du document ne correspond pas à aujourd'hui, avec un bouton en 1 clic pour ajuster la date.
  - Ce badge d'alerte et tous les boutons d'interface sont **strictement masqués** lors de l'export PDF et à l'impression.
- **Système de Modèles ("Templates")** :
  - Modèles intégrés préconfigurés (Devis standard avec acompte, Facture standard, Facture d'acompte, Facture de solde).
  - Possibilité de sauvegarder n'importe quel document personnalisé en tant que **Modèle** réutilisable.
  - Création de nouveau document depuis un modèle avec attribution instantanée d'un nouveau numéro et de la date du jour.
- **Nomenclature Intelligente & Export PDF Standardisé** :
  - Numérotation automatique :
    - Devis : `D-YYYYMMDD_XX` (ex: `D-20260827_01`)
    - Facture : `F-YYYYMMDD_XX`
    - Facture d'acompte : `FA-YYYYMMDD_XX`
    - Facture de solde : `FS-YYYYMMDD_XX`
    - Avoir : `AV-YYYYMMDD_XX`
  - Nommage automatique des fichiers PDF exportés : `[Numéro]_[Client]_[TypeDoc].pdf` (ex: `FS-20260827_01_ClientExemple_Facture_de_Solde.pdf`).
- **Profil Émetteur & Carnet de Clients** :
  - Vos informations (nom, adresse, SIRET, RIB) sont conservées par défaut.
  - Carnet d'adresses clients pour préremplir un document en un clic.

---

## 🚀 Utilisation Rapide

1. Ouvrez simplement le fichier `index.html` dans votre navigateur favori.
2. Pour créer un nouveau document :
   - Cliquez sur **+ Nouveau Document** dans la barre latérale gauche et choisissez le type souhaité ou un modèle.
3. Pour éditer :
   - Cliquez directement sur n'importe quel champ de la feuille A4 (titre, coordonnées, descriptions, prix, mentions).
   - Utilisez les boutons d'action rapide dans la barre supérieure pour afficher/masquer le **RIB Bancaire**, la **Ventilation Acompte/Solde**, ou le **Bloc Signature**.
4. Pour exporter :
   - Cliquez sur le bouton vert **📥 Exporter PDF** pour télécharger le fichier PDF prêt à être envoyé à votre client.
   - Ou cliquez sur **🖨️ Imprimer** (`Ctrl + P`) pour imprimer physiquement ou utiliser le moteur d'impression de votre navigateur.

---

## 📁 Structure du Projet

```
├── index.html                   # Interface et point d'entrée principal
├── css/
│   ├── app.css                  # Interface applicative (barre latérale, boutons, modales)
│   └── document.css             # Mise en page A4 et styles d'impression @media print
├── js/
│   ├── vendor/
│   │   └── html2pdf.bundle.min.js # Moteur d'export PDF hors-ligne
│   ├── nomenclature.js          # Génération des numéros et noms de fichiers
│   ├── calculations.js          # Calculs de TVA, HT, TTC, acomptes et formatage monétaire
│   ├── templates.js             # Modèles prédéfinis et gestionnaires de gabarits
│   ├── store.js                 # Persistance locale (localStorage) et sauvegardes JSON
│   └── app.js                   # Logique d'interaction et synchronisation temps réel
└── README.md                    # Documentation
```
