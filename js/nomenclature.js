/**
 * Nomenclature & Numérotation automatique des devis et factures
 * Règles :
 * - Devis : D-YYYYMMDD_XX (ex: D-20260704_05)
 * - Facture : F-YYYYMMDD_XX
 * - Facture d'acompte : FA-YYYYMMDD_XX
 * - Facture de solde : FS-YYYYMMDD_XX
 * - Avoir : AV-YYYYMMDD_XX
 */

const Nomenclature = {
  // Types de documents reconnus et leurs préfixes
  DOC_TYPES: {
    devis: { prefix: 'D-', label: 'Devis', title: 'Devis', defaultNumberPrefix: 'D-' },
    facture: { prefix: 'F-', label: 'Facture', title: 'Facture', defaultNumberPrefix: 'F-' },
    facture_acompte: { prefix: 'FA-', label: 'Facture d\'acompte', title: 'Facture d\'acompte', defaultNumberPrefix: 'FA-' },
    facture_solde: { prefix: 'FS-', label: 'Facture de Solde', title: 'Facture de Solde', defaultNumberPrefix: 'FS-' },
    avoir: { prefix: 'AV-', label: 'Avoir', title: 'Avoir', defaultNumberPrefix: 'AV-' }
  },

  /**
   * Retourne la date du jour au format ISO YYYY-MM-DD (fuseau local)
   * @returns {string}
   */
  getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /**
   * Formate une date en YYYY-MM-DD pour input type="date"
   * @param {Date|string} date 
   * @returns {string}
   */
  formatDateToISO(date) {
    if (!date) return this.getTodayISO();
    if (typeof date === 'string') {
      const trimmed = date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const p = trimmed.split('/');
        return `${p[2]}-${p[1]}-${p[0]}`;
      }
    }
    const d = this.parseDate(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /**
   * Formate une date JS ou ISO en YYYYMMDD compact
   * @param {Date|string} date 
   * @returns {string}
   */
  formatDateToYYYYMMDD(date) {
    const iso = this.formatDateToISO(date);
    return iso.replace(/-/g, '');
  },

  /**
   * Formate une date ISO ou JS en format d'affichage français DD/MM/YYYY
   * @param {Date|string} date 
   * @returns {string}
   */
  formatDateToFR(date) {
    if (!date) return '';
    if (typeof date === 'string') {
      const trimmed = date.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const parts = trimmed.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    const d = this.parseDate(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  },

  /**
   * Parse une date FR (DD/MM/YYYY) ou ISO (YYYY-MM-DD) en objet Date local
   * @param {string} dateStr 
   * @returns {Date}
   */
  parseDate(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date() : dateStr;
    const s = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const p = s.split(/[-T]/);
      return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    }
    const parts = s.split(/[/.-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        // DD/MM/YYYY
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  },

  /**
   * Vérifie de manière robuste si une chaîne de date correspond à aujourd'hui
   * @param {string|Date} dateVal 
   * @returns {{ isToday: boolean, todayISO: string, docDateISO: string, todayStrFR: string, docDateStrFR: string }}
   */
  checkIsToday(dateVal) {
    const todayISO = this.getTodayISO();
    const docDateISO = this.formatDateToISO(dateVal);
    const todayFR = this.formatDateToFR(todayISO);
    const docDateFR = this.formatDateToFR(docDateISO);
    return {
      isToday: todayISO === docDateISO,
      todayISO: todayISO,
      docDateISO: docDateISO,
      todayStrFR: todayFR,
      docDateStrFR: docDateFR
    };
  },

  /**
   * Génère le numéro séquentiel suivant pour un type de document à une date donnée
   * @param {string} type - 'devis', 'facture', 'facture_solde', etc.
   * @param {string|Date} docDate - Date du document
   * @param {Array} existingDocs - Liste des documents existants
   * @returns {string} Numéro généré (ex: D-20260827_01)
   */
  generateDocNumber(type, docDate = new Date(), existingDocs = []) {
    const typeInfo = this.DOC_TYPES[type] || { prefix: 'DOC-' };
    const prefix = typeInfo.prefix;
    const dateCode = this.formatDateToYYYYMMDD(docDate);

    // Trouver tous les documents du même préfixe et de la même date
    const pattern = new RegExp(`^${prefix.replace('-', '\\-')}${dateCode}_(\\d+)`);
    let maxSeq = 0;

    for (const doc of existingDocs) {
      if (!doc || !doc.numero) continue;
      const match = doc.numero.trim().match(pattern);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    const nextSeq = String(maxSeq + 1).padStart(2, '0');
    return `${prefix}${dateCode}_${nextSeq}`;
  },

  /**
   * Génère le nom de fichier PDF standardisé avec préfixe optionnel
   * Ex: MANTICORE_FS-20260827_01_Client_Facture_de_Solde.pdf
   * @param {Object} doc 
   * @returns {string}
   */
  generatePdfFilename(doc) {
    const sanitize = (str) => {
      if (!str) return '';
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Enlève accents
        .replace(/[^a-zA-Z0-9_-]/g, '_') // Remplace caractères spéciaux par _
        .replace(/_+/g, '_')             // Évite les underscores répétés
        .replace(/^_|_$/g, '');           // Évite _ au début/fin
    };

    const prefix = sanitize(doc.prefix || '');
    const num = sanitize(doc.numero || 'DOCUMENT');
    const client = sanitize(doc.client?.nom || 'Client');
    const docTypeLabel = sanitize(doc.titreDoc || (this.DOC_TYPES[doc.type]?.label || 'Document'));

    if (prefix) {
      return `${prefix}_${num}_${client}_${docTypeLabel}.pdf`;
    }
    return `${num}_${client}_${docTypeLabel}.pdf`;
  }
};

window.Nomenclature = Nomenclature;
