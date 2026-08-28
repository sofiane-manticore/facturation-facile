/**
 * PdfExporter.js - Générateur de PDF vectoriel haute définition avec texte sélectionnable
 * Utilise jsPDF et jspdf-autotable pour créer des PDF légers, nets et 100% sélectionnables.
 */

const PdfExporter = {
  /**
   * Nettoie une chaîne de caractères en remplaçant tout espace insécable ou unicode par un espace standard
   * @param {string|number} str 
   * @returns {string}
   */
  cleanText(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[\u00A0\u202F\u2000-\u200B]/g, ' ');
  },

  /**
   * Génère et télécharge le fichier PDF vectoriel du document actif
   * @param {Object} doc - Document complet
   * @param {string} filename - Nom du fichier de sortie
   */
  exportToPdf(doc, filename) {
    if (!doc) return;
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      console.error('jsPDF non disponible');
      window.print();
      return;
    }

    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    });

    const totals = Calculations.calculateDocumentTotals(doc);
    const currency = doc.devise || '€';
    const dateFR = Nomenclature.formatDateToFR(doc.dateEmission);

    const leftMargin = 14;
    const rightMargin = 196;
    const contentWidth = 182; // 196 - 14

    // ------------------------------------------------------------------------
    // 1. HAUT DE PAGE : TITRE & NUMÉROTATION
    // ------------------------------------------------------------------------
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(17, 17, 17);
    pdf.text(this.cleanText(doc.titreDoc || 'Devis'), leftMargin, 19);

    // Méta : Numéro & Date
    const metaXLabel = 105;
    const metaXVal = 148;

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(85, 85, 85);
    pdf.text(this.cleanText(doc.labelNumero || 'Numéro de document'), metaXLabel, 15);
    pdf.text(this.cleanText(doc.labelDate || 'Date d\'émission'), metaXLabel, 21);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(17, 17, 17);
    pdf.text(this.cleanText(doc.numero || ''), metaXVal, 15);
    pdf.text(this.cleanText(dateFR || ''), metaXVal, 21);

    // ------------------------------------------------------------------------
    // 2. COORDONNÉES ÉMETTEUR & CLIENT
    // ------------------------------------------------------------------------
    const yParties = 34;
    const xClient = 110;
    const maxClientWidth = 84;

    // Émetteur
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(17, 17, 17);
    pdf.text(this.cleanText(doc.emetteur?.nom || ''), leftMargin, yParties);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(85, 85, 85);
    let yE = yParties + 4.5;
    if (doc.emetteur?.ligne1) { pdf.text(this.cleanText(doc.emetteur.ligne1), leftMargin, yE); yE += 4.2; }
    if (doc.emetteur?.ligne2) { pdf.text(this.cleanText(doc.emetteur.ligne2), leftMargin, yE); yE += 4.2; }
    if (doc.emetteur?.email) { pdf.text(this.cleanText(doc.emetteur.email), leftMargin, yE); }

    // Client
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(17, 17, 17);
    pdf.text(this.cleanText(doc.client?.nom || ''), xClient, yParties);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(85, 85, 85);
    let yC = yParties + 4.5;
    if (doc.client?.adresse1) {
      const a1Lines = pdf.splitTextToSize(this.cleanText(doc.client.adresse1), maxClientWidth);
      pdf.text(a1Lines, xClient, yC);
      yC += a1Lines.length * 4.2;
    }
    if (doc.client?.adresse2) {
      const a2Lines = pdf.splitTextToSize(this.cleanText(doc.client.adresse2), maxClientWidth);
      pdf.text(a2Lines, xClient, yC);
      yC += a2Lines.length * 4.2;
    }
    if (doc.client?.email) {
      pdf.text(this.cleanText(doc.client.email), xClient, yC);
    }

    // ------------------------------------------------------------------------
    // 3. TABLEAU DES PRESTATIONS
    // ------------------------------------------------------------------------
    const tableStartY = Math.max(yE, yC) + 7;
    const items = doc.items || [];

    const tableBody = items.map(item => {
      const lineCalc = Calculations.calculateLine(item);
      const puNum = Calculations.parseAmount(item.prixUnitaire);
      const puStr = this.cleanText(Calculations.formatCurrency(puNum, currency, false));
      const totStr = this.cleanText(Calculations.formatCurrency(lineCalc.totalHT, currency, false));
      const tvaStr = `${Calculations.parseAmount(item.tva)}%`;
      return [
        this.cleanText(item.description || ''),
        this.cleanText(String(item.qte || '1')),
        puStr,
        tvaStr,
        totStr
      ];
    });

    pdf.autoTable({
      startY: tableStartY,
      margin: { left: leftMargin, right: leftMargin },
      tableWidth: contentWidth,
      head: [[
        'Description',
        'Qté',
        this.cleanText(`Prix unitaire (${currency})`),
        'TVA (%)',
        this.cleanText(`Total HT (${currency})`)
      ]],
      body: tableBody,
      theme: 'plain',
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [17, 17, 17],
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        lineColor: [226, 232, 240],
        lineWidth: { bottom: 0.15 }
      },
      columnStyles: {
        0: { cellWidth: 92, halign: 'left' },
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
      }
    });

    let currentY = pdf.lastAutoTable.finalY + 4;

    // ------------------------------------------------------------------------
    // 4. TOTAUX AVEC LIGNES POINTILLÉES
    // ------------------------------------------------------------------------
    const totalsLeft = 110;
    const totalsRight = rightMargin;
    const totalLineHeight = 4.2;

    const drawTotalLine = (label, rawValueStr, isBold = false) => {
      const valueStr = this.cleanText(rawValueStr);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(17, 17, 17);

      const labelClean = this.cleanText(label);
      const labelWidth = pdf.getTextWidth(labelClean);
      const valWidth = pdf.getTextWidth(valueStr);

      // Label à gauche
      pdf.text(labelClean, totalsLeft, currentY);

      // Ligne de pointillés au milieu
      const dotStartX = totalsLeft + labelWidth + 2;
      const dotEndX = totalsRight - valWidth - 2;
      if (dotEndX > dotStartX) {
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineDashPattern([0.4, 0.8], 0);
        pdf.line(dotStartX, currentY - 0.7, dotEndX, currentY - 0.7);
        pdf.setLineDashPattern([], 0); // reset
      }

      // Montant à droite aligné précisément sur la marge de droite
      pdf.text(valueStr, totalsRight, currentY, { align: 'right' });
      currentY += totalLineHeight;
    };

    drawTotalLine('Total HT', totals.formatted.totalHT);
    drawTotalLine('Montant total de la TVA', totals.formatted.totalTVA);
    drawTotalLine('Total TTC', totals.formatted.totalTTC, true);

    if (doc.showAcompteSolde) {
      const aLabel = `${doc.labelAcompte || 'Acompte à la commande'} (${totals.acomptePercent}%)`;
      const sLabel = `${doc.labelSolde || 'Solde à la livraison'} (${totals.soldePercent}%)`;
      drawTotalLine(aLabel, totals.formatted.acompteMontant);
      drawTotalLine(sLabel, totals.formatted.soldeMontant);
    }

    currentY += 2;

    // ------------------------------------------------------------------------
    // 5. COORDONNÉES BANCAIRES (SI ACTIVÉES)
    // ------------------------------------------------------------------------
    if (doc.showBanque && doc.banque) {
      pdf.autoTable({
        startY: currentY,
        margin: { left: leftMargin, right: leftMargin },
        tableWidth: contentWidth,
        head: [['Titulaire du compte', 'Banque', 'IBAN', 'BIC']],
        body: [[
          this.cleanText(doc.banque.titulaire || ''),
          this.cleanText(doc.banque.banque || ''),
          this.cleanText(doc.banque.iban || ''),
          this.cleanText(doc.banque.bic || '')
        ]],
        theme: 'plain',
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 }
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [17, 17, 17],
          cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
          lineColor: [226, 232, 240],
          lineWidth: { bottom: 0.15 }
        },
        columnStyles: {
          0: { cellWidth: 46, halign: 'left' },
          1: { cellWidth: 46, halign: 'left' },
          2: { cellWidth: 66, halign: 'left', fontStyle: 'bold' },
          3: { cellWidth: 24, halign: 'left', fontStyle: 'bold' }
        }
      });

      currentY = pdf.lastAutoTable.finalY + 4;
    }

    // ------------------------------------------------------------------------
    // 6. CLAUSES & MENTIONS LÉGALES
    // ------------------------------------------------------------------------
    const clauses = doc.clauses || [];
    if (clauses.length > 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(55, 65, 81);

      clauses.forEach(clause => {
        if (!clause || !clause.trim()) return;
        const cleanClause = this.cleanText(clause.trim());
        const splitLines = pdf.splitTextToSize(cleanClause, contentWidth);
        pdf.text(splitLines, leftMargin, currentY);
        currentY += (splitLines.length * 3.3) + 1.2;
      });
    }

    // ------------------------------------------------------------------------
    // 7. BLOC DE SIGNATURE CLIENT (SI ACTIVÉ)
    // ------------------------------------------------------------------------
    if (doc.showSignature) {
      currentY += 2;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(17, 17, 17);
      pdf.text(this.cleanText(doc.signatureText || 'Bon pour accord, date et signature du client :'), leftMargin, currentY);
    }

    // ------------------------------------------------------------------------
    // 8. PIED DE PAGE (BAS DE PAGE)
    // ------------------------------------------------------------------------
    if (doc.basDePage && doc.basDePage.trim()) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(120, 120, 120);
      pdf.text(this.cleanText(doc.basDePage.trim()), 105, 287, { align: 'center' });
    }

    // ------------------------------------------------------------------------
    // TÉLÉCHARGEMENT DIRECT
    // ------------------------------------------------------------------------
    pdf.save(filename);
  }
};

window.PdfExporter = PdfExporter;
