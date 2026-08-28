/**
 * Calculations.js - Moteur de calcul financier et de formatage de devis/factures
 */

const Calculations = {
  /**
   * Extrait la valeur numérique d'une chaîne de quantité (ex: "2j" -> 2, "3.5 h" -> 3.5, "1" -> 1)
   * @param {string|number} qty 
   * @returns {number}
   */
  parseQuantity(qty) {
    if (typeof qty === 'number') return isNaN(qty) ? 0 : qty;
    if (!qty) return 0;
    const cleanStr = String(qty).replace(',', '.').trim();
    const match = cleanStr.match(/[-+]?[0-9]*\.?[0-9]+/);
    return match ? parseFloat(match[0]) : 0;
  },

  /**
   * Parse un montant ou pourcentage en nombre flottant
   * @param {string|number} val 
   * @returns {number}
   */
  parseAmount(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const cleanStr = String(val)
      .replace(/\s+/g, '')
      .replace(/[€$£¥]|CHF|CA\$|MAD|DZD|TND|FCFA|DH|DA|DT/gi, '')
      .replace('%', '')
      .replace(',', '.');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
  },

  /**
   * Formate un nombre en montant monétaire avec la devise choisie (ex: 3600 -> "3 600,00 €" ou "3 600,00 $")
   * @param {number} amount 
   * @param {string} currency - symbole de la devise (défaut '€')
   * @param {boolean} includeSymbol - inclure le symbole
   * @returns {string}
   */
  formatCurrency(amount, currency = '€', includeSymbol = true) {
    const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    const symb = currency || '€';
    // Format français avec 2 décimales et remplacement des espaces insécables \u202F et \u00A0
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num).replace(/[\u00A0\u202F\u2000-\u200B]/g, ' ');

    return includeSymbol ? `${formatted} ${symb}` : formatted;
  },

  /**
   * Calcule les totaux d'une ligne de prestation
   * @param {Object} item - { description, qte, prixUnitaire, tva }
   * @returns {Object} { totalHT, montantTVA, totalTTC }
   */
  calculateLine(item) {
    const qteNum = this.parseQuantity(item.qte);
    const prixUnit = this.parseAmount(item.prixUnitaire);
    const tvaRate = this.parseAmount(item.tva);

    const totalHT = qteNum * prixUnit;
    const montantTVA = totalHT * (tvaRate / 100);
    const totalTTC = totalHT + montantTVA;

    return {
      totalHT: Math.round(totalHT * 100) / 100,
      montantTVA: Math.round(montantTVA * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100
    };
  },

  /**
   * Calcule l'ensemble des totaux d'un document
   * @param {Object} doc - Document complet
   * @returns {Object}
   */
  calculateDocumentTotals(doc) {
    const items = doc?.items || [];
    const currency = doc?.devise || '€';
    let totalHT = 0;
    let totalTVA = 0;
    const tvaBreakdown = {};

    items.forEach((item) => {
      const lineCalc = this.calculateLine(item);
      totalHT += lineCalc.totalHT;
      totalTVA += lineCalc.montantTVA;

      const rate = this.parseAmount(item.tva);
      if (!tvaBreakdown[rate]) {
        tvaBreakdown[rate] = { base: 0, tva: 0 };
      }
      tvaBreakdown[rate].base += lineCalc.totalHT;
      tvaBreakdown[rate].tva += lineCalc.montantTVA;
    });

    totalHT = Math.round(totalHT * 100) / 100;
    totalTVA = Math.round(totalTVA * 100) / 100;
    const totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;

    // Calcul de l'acompte
    const acomptePercent = doc?.acomptePercent !== undefined ? this.parseAmount(doc.acomptePercent) : 40;
    const acompteMontant = doc?.acompteMontant !== undefined && doc.acompteMontant !== null && doc.acompteMontant !== ''
      ? this.parseAmount(doc.acompteMontant)
      : Math.round(totalTTC * (acomptePercent / 100) * 100) / 100;

    // Calcul du solde
    const soldePercent = 100 - acomptePercent;
    const soldeMontant = Math.round((totalTTC - acompteMontant) * 100) / 100;

    return {
      totalHT,
      totalTVA,
      totalTTC,
      tvaBreakdown,
      acomptePercent,
      acompteMontant,
      soldePercent,
      soldeMontant,
      currency,
      // Versions formatées en chaîne avec la devise active
      formatted: {
        totalHT: this.formatCurrency(totalHT, currency),
        totalTVA: this.formatCurrency(totalTVA, currency),
        totalTTC: this.formatCurrency(totalTTC, currency),
        acompteMontant: this.formatCurrency(acompteMontant, currency),
        soldeMontant: this.formatCurrency(soldeMontant, currency)
      }
    };
  }
};

window.Calculations = Calculations;
