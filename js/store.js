/**
 * Store.js - Gestionnaire de stockage local (localStorage) et persistance
 */

const STORAGE_KEYS = {
  DOCS: 'manticore_docs_v1',
  USER_TEMPLATES: 'manticore_templates_v1',
  CLIENTS: 'manticore_clients_v1',
  PROFILE: 'manticore_profile_v1',
  ACTIVE_DOC_ID: 'manticore_active_doc_id_v1',
  SHOW_ARCHIVED: 'manticore_show_archived_v1'
};

const Store = {
  /**
   * Initialise les données si le stockage est vide
   */
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.PROFILE)) {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(DEFAULT_PROFILE));
    }

    if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(DEFAULT_CLIENTS));
    }

    if (!localStorage.getItem(STORAGE_KEYS.USER_TEMPLATES)) {
      localStorage.setItem(STORAGE_KEYS.USER_TEMPLATES, JSON.stringify([]));
    }

    if (!localStorage.getItem(STORAGE_KEYS.DOCS)) {
      const todayISO = Nomenclature.getTodayISO();
      const initialDevis = {
        id: 'doc_devis_01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isTemplate: false,
        status: 'brouillon',
        type: 'devis',
        prefix: 'PROJET_01',
        prefixColor: '#38bdf8',
        devise: '€',
        archived: false,
        titreDoc: 'Devis',
        labelNumero: 'Numéro de devis',
        numero: 'D-' + Nomenclature.formatDateToYYYYMMDD(new Date()) + '_01',
        labelDate: 'Date d\'émission',
        dateEmission: todayISO,
        emetteur: {
          nom: '',
          ligne1: '',
          ligne2: '',
          email: ''
        },
        client: {
          nom: '',
          adresse1: '',
          adresse2: '',
          email: ''
        },
        items: [
          { id: 'item_1', description: 'Prestation de service...', qte: '1', prixUnitaire: 0, tva: 0 }
        ],
        showAcompteSolde: true,
        acomptePercent: 40,
        labelAcompte: 'Acompte à la commande',
        labelSolde: 'Solde à la livraison',
        showBanque: false,
        banque: {
          titulaire: '',
          banque: '',
          iban: '',
          bic: ''
        },
        clauses: [
          'TVA non applicable, article 293 B du Code Général des Impôts.',
          'Devis valable 30 jours.'
        ],
        showSignature: true,
        signatureText: 'Bon pour accord, date et signature du client :',
        basDePage: ''
      };

      const initialDocs = [initialDevis];
      localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(initialDocs));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DOC_ID, initialDevis.id);
    }
  },

  // --- DOCUMENTS ---
  getAllDocs() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DOCS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Erreur lecture docs:', e);
      return [];
    }
  },

  getDoc(id) {
    const docs = this.getAllDocs();
    return docs.find(d => d.id === id) || null;
  },

  saveDoc(doc) {
    if (!doc || !doc.id) return null;
    const docs = this.getAllDocs();
    const idx = docs.findIndex(d => d.id === doc.id);
    doc.updatedAt = new Date().toISOString();

    if (idx >= 0) {
      docs[idx] = { ...docs[idx], ...doc };
    } else {
      docs.unshift(doc);
    }

    localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(docs));
    return doc;
  },

  deleteDoc(id) {
    const docs = this.getAllDocs().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(docs));

    // Si on supprime le document actif, en sélectionner un autre
    if (this.getActiveDocId() === id) {
      const nextId = docs.length > 0 ? docs[0].id : null;
      this.setActiveDocId(nextId);
    }
  },

  duplicateDoc(id) {
    const original = this.getDoc(id);
    if (!original) return null;

    const copy = JSON.parse(JSON.stringify(original));
    copy.id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = new Date().toISOString();
    copy.status = 'brouillon';
    copy.isTemplate = false;

    // Nouveau numéro et date du jour
    const todayISO = Nomenclature.getTodayISO();
    copy.dateEmission = todayISO;
    copy.numero = Nomenclature.generateDocNumber(copy.type, todayISO, this.getAllDocs());

    this.saveDoc(copy);
    this.setActiveDocId(copy.id);
    return copy;
  },

  getActiveDocId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_DOC_ID);
  },

  setActiveDocId(id) {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DOC_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_DOC_ID);
    }
  },

  // --- GESTION DES PROJETS, UNICITÉ ET COULEURS ---
  /**
   * Retourne la liste de tous les projets avec leur couleur, nombre de documents et état d'archivage
   */
  getDistinctProjects() {
    const docs = this.getAllDocs();
    const projectsMap = {};

    docs.forEach(d => {
      const pName = (d.prefix || '').trim();
      if (pName) {
        if (!projectsMap[pName]) {
          projectsMap[pName] = {
            name: pName,
            color: d.prefixColor || '#38bdf8',
            count: 0,
            archivedCount: 0,
            client: d.client?.nom || ''
          };
        }
        projectsMap[pName].count++;
        if (d.archived) projectsMap[pName].archivedCount++;
      }
    });

    return Object.values(projectsMap);
  },

  /**
   * Vérifie si un nom de projet est disponible (unicité stricte)
   * @param {string} newName - Nom proposé
   * @param {string} excludeCurrentName - Nom actuel du projet en cas de renommage
   * @returns {boolean} true si le nom est disponible
   */
  isProjectNameUnique(newName, excludeCurrentName = '') {
    if (!newName || !newName.trim()) return false;
    const target = newName.trim().toUpperCase().replace(/\s+/g, '_');
    const current = excludeCurrentName ? excludeCurrentName.trim().toUpperCase().replace(/\s+/g, '_') : '';
    
    if (current && target === current) return true;

    const existing = this.getDistinctProjects();
    return !existing.some(p => p.name.toUpperCase() === target);
  },

  /**
   * Renomme un projet sur l'ENSEMBLE de ses devis et factures
   * @param {string} oldName - Ancien nom de projet
   * @param {string} newName - Nouveau nom unique
   * @returns {Object} Résultat de l'opération
   */
  renameProject(oldName, newName) {
    if (!oldName || !newName) return { success: false, error: 'Nom de projet invalide' };

    const oldNorm = oldName.trim().toUpperCase().replace(/\s+/g, '_');
    const newNorm = newName.trim().toUpperCase().replace(/\s+/g, '_');

    if (oldNorm === newNorm) return { success: true, count: 0 };

    if (!this.isProjectNameUnique(newNorm, oldNorm)) {
      return { success: false, error: `Le projet "${newNorm}" existe déjà. Veuillez choisir un nom unique ou utiliser le rattachement de projet.` };
    }

    const docs = this.getAllDocs();
    let updatedCount = 0;

    docs.forEach(d => {
      if ((d.prefix || '').trim().toUpperCase().replace(/\s+/g, '_') === oldNorm) {
        d.prefix = newNorm;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(docs));
    }

    return { success: true, count: updatedCount, newName: newNorm };
  },

  /**
   * Rattache un document spécifique à un projet existant
   */
  reassignDocProject(docId, targetProjectName) {
    const doc = this.getDoc(docId);
    if (!doc || !targetProjectName) return null;

    const normTarget = targetProjectName.trim().toUpperCase().replace(/\s+/g, '_');
    const projects = this.getDistinctProjects();
    const existingProj = projects.find(p => p.name.toUpperCase() === normTarget);

    doc.prefix = normTarget;
    if (existingProj && existingProj.color) {
      doc.prefixColor = existingProj.color;
    }

    this.saveDoc(doc);
    return doc;
  },

  /**
   * Fusionne/rattache tous les documents d'un projet source vers un projet cible existant
   */
  mergeProjects(fromProjectName, toProjectName) {
    if (!fromProjectName || !toProjectName) return { success: false, count: 0 };
    const fromNorm = fromProjectName.trim().toUpperCase().replace(/\s+/g, '_');
    const toNorm = toProjectName.trim().toUpperCase().replace(/\s+/g, '_');

    if (fromNorm === toNorm) return { success: true, count: 0 };

    const projects = this.getDistinctProjects();
    const targetProj = projects.find(p => p.name.toUpperCase() === toNorm);
    const targetColor = targetProj ? targetProj.color : '#38bdf8';

    const docs = this.getAllDocs();
    let count = 0;
    docs.forEach(d => {
      if ((d.prefix || '').trim().toUpperCase().replace(/\s+/g, '_') === fromNorm) {
        d.prefix = toNorm;
        d.prefixColor = targetColor;
        count++;
      }
    });

    if (count > 0) {
      localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(docs));
    }

    return { success: true, count: count, targetName: toNorm };
  },

  /**
   * Met à jour la couleur d'un projet sur tous ses documents
   */
  updateProjectColor(projectName, color) {
    if (!projectName) return;
    const docs = this.getAllDocs();
    let updatedCount = 0;
    const normName = projectName.trim().toUpperCase().replace(/\s+/g, '_');

    docs.forEach(d => {
      if ((d.prefix || '').trim().toUpperCase().replace(/\s+/g, '_') === normName) {
        d.prefixColor = color;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(docs));
    }
  },

  /**
   * Archive ou désarchive un document spécifique
   */
  setDocumentArchived(docId, archived = true) {
    const doc = this.getDoc(docId);
    if (!doc) return null;
    doc.archived = !!archived;
    this.saveDoc(doc);
    return doc;
  },

  /**
   * Archive ou désarchive tous les documents d'un projet donné
   */
  setProjectArchived(projectName, archived = true) {
    if (!projectName) return;
    const docs = this.getAllDocs();
    const norm = projectName.trim().toUpperCase().replace(/\s+/g, '_');
    docs.forEach(d => {
      if ((d.prefix || '').trim().toUpperCase().replace(/\s+/g, '_') === norm) {
        d.archived = !!archived;
      }
    });
    localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(docs));
  },

  // --- LIAISON DEVIS <-> FACTURES ---
  getLinkedInvoices(devisId) {
    if (!devisId) return [];
    const all = this.getAllDocs();
    return all.filter(d => d.linkedDevisId === devisId);
  },

  getAllDevis() {
    return this.getAllDocs().filter(d => d.type.startsWith('devis'));
  },

  linkInvoiceToDevis(invoiceId, devisId) {
    const invoice = this.getDoc(invoiceId);
    const devis = this.getDoc(devisId);
    if (!invoice) return;

    if (devis) {
      invoice.linkedDevisId = devis.id;
      invoice.linkedDevisNumero = devis.numero;
      // Règle stricte : la facture rattachée DOIT obligatoirement être dans le même projet que le devis
      invoice.prefix = devis.prefix || '';
      invoice.prefixColor = devis.prefixColor || '#38bdf8';
    } else {
      invoice.linkedDevisId = null;
      invoice.linkedDevisNumero = null;
    }
    this.saveDoc(invoice);
  },

  createInvoiceFromDevis(devisId, invoiceType = 'facture_solde') {
    const devis = this.getDoc(devisId);
    if (!devis) return null;

    const profile = this.getProfile();
    const existingDocs = this.getAllDocs();
    const todayISO = Nomenclature.getTodayISO();
    const totals = Calculations.calculateDocumentTotals(devis);
    const docNumber = Nomenclature.generateDocNumber(invoiceType, todayISO, existingDocs);

    const template = Templates.getBuiltinTemplates().find(t => t.type === invoiceType) || Templates.getBuiltinTemplates()[1];

    let items = [];
    if (invoiceType === 'facture_acompte') {
      const acomptePct = devis.acomptePercent || 40;
      const desc = `Acompte de ${acomptePct}% sur devis n° ${devis.numero} (${devis.items[0]?.description || 'Prestation'})`;
      items = [
        { id: 'item_1', description: desc, qte: '1', prixUnitaire: totals.acompteMontant, tva: 0 }
      ];
    } else if (invoiceType === 'facture_solde') {
      const existingAcomptes = this.getLinkedInvoices(devisId).filter(d => d.type === 'facture_acompte');
      const acompteRef = existingAcomptes.length > 0 
        ? `(Facture d'acompte n° ${existingAcomptes.map(a => a.numero).join(', ')})`
        : `(Acompte versé sur devis n° ${devis.numero})`;

      items = [
        { id: 'item_1', description: `Prestation globale (${devis.items[0]?.description || 'Décor virtuel'})`, qte: '1', prixUnitaire: totals.totalTTC, tva: 0 },
        { id: 'item_2', description: `Moins acompte déjà versé ${acompteRef}`, qte: '1', prixUnitaire: -totals.acompteMontant, tva: 0 }
      ];
    } else {
      items = (devis.items || []).map((it, idx) => ({ ...it, id: 'item_' + idx }));
    }

    const newInvoice = {
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isTemplate: false,
      status: 'brouillon',
      type: invoiceType,
      prefix: devis.prefix || '',
      prefixColor: devis.prefixColor || '#38bdf8',
      archived: false,
      linkedDevisId: devis.id,
      linkedDevisNumero: devis.numero,
      titreDoc: template.titreDoc || (Nomenclature.DOC_TYPES[invoiceType]?.title || 'Facture'),
      labelNumero: template.labelNumero || 'Numéro de facture',
      numero: docNumber,
      labelDate: 'Date d\'émission',
      dateEmission: todayISO,

      emetteur: { ...devis.emetteur },
      client: { ...devis.client },
      items: items,

      showAcompteSolde: false,
      acomptePercent: devis.acomptePercent || 40,
      labelAcompte: devis.labelAcompte || 'Acompte à la commande',
      labelSolde: devis.labelSolde || 'Solde à la livraison',

      showBanque: true,
      banque: devis.banque ? { ...devis.banque } : { ...profile.banque },

      clauses: template.clauses && template.clauses.length > 0 ? [...template.clauses] : [
        'TVA non applicable, article 293 B du Code Général des Impôts.',
        'Conditions de paiement : Paiement à réception de facture (ou sous 30 jours). En cas de retard de paiement, des pénalités de retard calculées au taux annuel de 10 % seront exigibles de plein droit le jour suivant la date de règlement figurant sur la facture. Conformément à l\'article D.441-5 du Code de commerce, une indemnité forfaitaire pour frais de recouvrement de 40 € sera également due.'
      ],
      showSignature: false,
      signatureText: '',
      basDePage: devis.basDePage || profile.mentionBasDePage
    };

    this.saveDoc(newInvoice);
    this.setActiveDocId(newInvoice.id);
    return newInvoice;
  },

  // --- TEMPLATES UTILISATEUR ---
  getUserTemplates() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_TEMPLATES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  getAllTemplatesCombined() {
    const builtins = Templates.getBuiltinTemplates();
    const userTemplates = this.getUserTemplates();
    return [...builtins, ...userTemplates];
  },

  saveUserTemplate(docOrTemplate, customName = '') {
    const templates = this.getUserTemplates();
    const template = {
      id: 'template_user_' + Date.now(),
      name: customName || `Modèle (${docOrTemplate.titreDoc || 'Document'} - ${docOrTemplate.client?.nom || 'Générique'})`,
      description: `Créé à partir de ${docOrTemplate.numero || docOrTemplate.titreDoc}`,
      createdAt: new Date().toISOString(),
      isCustom: true,
      type: docOrTemplate.type || 'devis',
      prefix: docOrTemplate.prefix || '',
      prefixColor: docOrTemplate.prefixColor || '#38bdf8',
      titreDoc: docOrTemplate.titreDoc,
      labelNumero: docOrTemplate.labelNumero,
      labelDate: docOrTemplate.labelDate,
      showAcompteSolde: docOrTemplate.showAcompteSolde,
      acomptePercent: docOrTemplate.acomptePercent,
      labelAcompte: docOrTemplate.labelAcompte,
      labelSolde: docOrTemplate.labelSolde,
      showBanque: docOrTemplate.showBanque,
      showSignature: docOrTemplate.showSignature,
      signatureText: docOrTemplate.signatureText,
      items: (docOrTemplate.items || []).map(it => ({ ...it })),
      clauses: [...(docOrTemplate.clauses || [])]
    };

    templates.unshift(template);
    localStorage.setItem(STORAGE_KEYS.USER_TEMPLATES, JSON.stringify(templates));
    return template;
  },

  deleteUserTemplate(id) {
    const templates = this.getUserTemplates().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.USER_TEMPLATES, JSON.stringify(templates));
  },

  // --- CLIENTS ---
  getClients() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveClient(client) {
    if (!client.id) {
      client.id = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    }
    const clients = this.getClients();
    const idx = clients.findIndex(c => c.id === client.id);
    if (idx >= 0) {
      clients[idx] = { ...clients[idx], ...client };
    } else {
      clients.push(client);
    }
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
    return client;
  },

  deleteClient(id) {
    const clients = this.getClients().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  },

  // --- PROFIL ÉMETTEUR ---
  getProfile() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return data ? JSON.parse(data) : DEFAULT_PROFILE;
    } catch (e) {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile) {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  },

  // --- EXPORT & IMPORT DE SAUVEGARDE COMPLÈTE ---
  exportBackupJSON() {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      clients: this.getClients(),
      userTemplates: this.getUserTemplates(),
      documents: this.getAllDocs()
    };
    return JSON.stringify(backup, null, 2);
  },

  importBackupJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.profile) this.saveProfile(data.profile);
      if (Array.isArray(data.clients)) localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(data.clients));
      if (Array.isArray(data.userTemplates)) localStorage.setItem(STORAGE_KEYS.USER_TEMPLATES, JSON.stringify(data.userTemplates));
      if (Array.isArray(data.documents)) localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(data.documents));
      if (data.documents && data.documents.length > 0) {
        this.setActiveDocId(data.documents[0].id);
      }
      return { success: true, count: data.documents ? data.documents.length : 0 };
    } catch (e) {
      console.error('Erreur import JSON:', e);
      return { success: false, error: e.message };
    }
  }
};

window.Store = Store;
