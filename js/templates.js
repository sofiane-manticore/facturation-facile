/**
 * Templates.js - Modèles intégrés par défaut et gestion des modèles utilisateurs
 * Fichier 100% anonymisé et neutre pour utilisation publique / open source.
 */

const DEFAULT_PROFILE = {
  nom: '',
  ligne1: '',
  ligne2: '',
  email: '',
  siret: '',
  statut: '',
  mentionBasDePage: '',
  banque: {
    titulaire: '',
    banque: '',
    iban: '',
    bic: ''
  }
};

const DEFAULT_CLIENTS = [];

const BUILTIN_TEMPLATES = [
  {
    id: 'template_devis_standard',
    name: 'Devis Standard',
    description: 'Modèle de devis standard prêt à remplir avec acompte et conditions.',
    type: 'devis',
    titreDoc: 'Devis',
    labelNumero: 'Numéro de devis',
    labelDate: 'Date d\'émission',
    showAcompteSolde: true,
    acomptePercent: 40,
    showBanque: false,
    showSignature: true,
    items: [
      { id: '1', description: 'Prestation de service...', qte: '1', prixUnitaire: 0, tva: 0 }
    ],
    clauses: [
      'TVA non applicable, article 293 B du Code Général des Impôts.',
      'Devis valable 30 jours.',
      'Le début de l\'exécution de la prestation est conditionné par la réception du devis signé et le paiement de l\'acompte de 40 %.'
    ],
    signatureText: 'Bon pour accord, date et signature du client :'
  },
  {
    id: 'template_facture_standard',
    name: 'Facture Standard - Prestation de Service',
    description: 'Facture directe à 100% avec mentions légales et coordonnées bancaires.',
    type: 'facture',
    titreDoc: 'Facture',
    labelNumero: 'Numéro de facture',
    labelDate: 'Date d\'émission',
    showAcompteSolde: false,
    showBanque: true,
    showSignature: false,
    items: [
      { id: '1', description: 'Prestation de service...', qte: '1', prixUnitaire: 0, tva: 0 }
    ],
    clauses: [
      'TVA non applicable, article 293 B du Code Général des Impôts.',
      'Conditions de paiement : Paiement à réception de facture (ou sous 30 jours). En cas de retard de paiement, des pénalités de retard calculées au taux légal de 10 % ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement seront exigibles de plein droit.'
    ],
    signatureText: ''
  },
  {
    id: 'template_facture_acompte',
    name: 'Facture d\'Acompte (40%)',
    description: 'Facture d\'acompte standard avant démarrage de la prestation.',
    type: 'facture_acompte',
    titreDoc: 'Facture d\'acompte',
    labelNumero: 'Numéro de facture',
    labelDate: 'Date d\'émission',
    showAcompteSolde: false,
    showBanque: true,
    showSignature: false,
    items: [
      { id: '1', description: 'Acompte de 40% sur devis', qte: '1', prixUnitaire: 0, tva: 0 }
    ],
    clauses: [
      'TVA non applicable, article 293 B du Code Général des Impôts.',
      'Conditions de paiement : Paiement à réception de facture. Le début de l\'exécution de la prestation est conditionné par le règlement du présent acompte.',
      'En cas de retard de paiement, des pénalités de retard au taux annuel de 10 % ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement seront exigibles.'
    ],
    signatureText: ''
  },
  {
    id: 'template_facture_solde',
    name: 'Facture de Solde - Avec Déduction d\'Acompte',
    description: 'Facture finale déduisant l\'acompte déjà perçu, avec coordonnées bancaires et pénalités de retard.',
    type: 'facture_solde',
    titreDoc: 'Facture de Solde',
    labelNumero: 'Numéro de facture',
    labelDate: 'Date d\'émission',
    showAcompteSolde: false,
    showBanque: true,
    showSignature: false,
    items: [
      { id: '1', description: 'Prestation globale', qte: '1', prixUnitaire: 0, tva: 0 },
      { id: '2', description: 'Moins acompte déjà versé', qte: '1', prixUnitaire: 0, tva: 0 }
    ],
    clauses: [
      'TVA non applicable, article 293 B du Code Général des Impôts.',
      'Conditions de paiement : Paiement à réception de facture (ou sous 30 jours). En cas de retard de paiement, des pénalités de retard calculées au taux annuel de 10 % seront exigibles de plein droit. Conformément à l\'article D.441-5 du Code de commerce, une indemnité forfaitaire pour frais de recouvrement de 40 € sera également due.'
    ],
    signatureText: ''
  }
];

const Templates = {
  getBuiltinTemplates() {
    return BUILTIN_TEMPLATES;
  },

  /**
   * Crée un nouveau document à partir d'un modèle (builtin ou utilisateur)
   * @param {Object} template 
   * @param {Object} options - { profile, client, existingDocs, date }
   * @returns {Object} Nouveau document complet
   */
  createDocumentFromTemplate(template, options = {}) {
    const today = new Date();
    const docDate = options.date || today;
    const docDateFR = Nomenclature.formatDateToFR(docDate);
    const existingDocs = options.existingDocs || [];
    const type = template.type || 'devis';
    const numero = Nomenclature.generateDocNumber(type, docDate, existingDocs);
    const profile = options.profile || DEFAULT_PROFILE;
    const client = options.client || (DEFAULT_CLIENTS[0] ? { ...DEFAULT_CLIENTS[0] } : {
      nom: '',
      adresse1: '',
      adresse2: '',
      email: ''
    });

    const newDoc = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isTemplate: false,
      status: 'brouillon', // brouillon, envoye, accepte, paye, annule
      type: type,
      titreDoc: template.titreDoc || (Nomenclature.DOC_TYPES[type]?.title || 'Devis'),
      labelNumero: template.labelNumero || (type.startsWith('devis') ? 'Numéro de devis' : 'Numéro de facture'),
      numero: numero,
      labelDate: template.labelDate || 'Date d\'émission',
      dateEmission: Nomenclature.formatDateToISO(docDate),
      prefix: template.prefix || '',
      prefixColor: template.prefixColor || '#38bdf8',
      devise: template.devise || profile.devise || '€',

      // Émetteur
      emetteur: {
        nom: profile.nom || '',
        ligne1: profile.ligne1 || '',
        ligne2: profile.ligne2 || '',
        email: profile.email || ''
      },

      // Client
      client: {
        nom: client.nom || '',
        adresse1: client.adresse1 || '',
        adresse2: client.adresse2 || '',
        email: client.email || ''
      },

      // Lignes de prestations
      items: (template.items || []).map((item, idx) => ({
        id: 'item_' + Date.now() + '_' + idx,
        description: item.description || '',
        qte: item.qte !== undefined ? item.qte : '1',
        prixUnitaire: item.prixUnitaire !== undefined ? item.prixUnitaire : 0,
        tva: item.tva !== undefined ? item.tva : 0
      })),

      // Options de totaux
      showAcompteSolde: template.showAcompteSolde !== undefined ? template.showAcompteSolde : (type === 'devis'),
      acomptePercent: template.acomptePercent !== undefined ? template.acomptePercent : 40,
      labelAcompte: template.labelAcompte || 'Acompte à la commande',
      labelSolde: template.labelSolde || 'Solde à la livraison',

      // Coordonnées bancaires
      showBanque: template.showBanque !== undefined ? template.showBanque : (type.startsWith('facture')),
      banque: {
        titulaire: profile.banque?.titulaire || '',
        banque: profile.banque?.banque || '',
        iban: profile.banque?.iban || '',
        bic: profile.banque?.bic || ''
      },

      // Clauses & Mentions
      clauses: Array.isArray(template.clauses) ? [...template.clauses] : [],

      // Signature
      showSignature: template.showSignature !== undefined ? template.showSignature : (type === 'devis'),
      signatureText: template.signatureText || 'Bon pour accord, date et signature du client :',

      // Pied de page
      basDePage: profile.mentionBasDePage || ''
    };

    return newDoc;
  }
};

window.Templates = Templates;
window.DEFAULT_PROFILE = DEFAULT_PROFILE;
window.DEFAULT_CLIENTS = DEFAULT_CLIENTS;
