/**
 * App.js - Contrôleur principal de l'application Manticore Studio Devis & Factures
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialisation de la persistance
  Store.init();

  let activeDoc = null;
  let activeFilter = 'all'; // 'all', 'devis', 'facture'
  let filterStatus = 'all'; // 'all', 'brouillon', 'envoye', 'accepte', 'paye', 'annule'
  let filterProject = 'all'; // 'all' ou nom du projet
  let filterClient = 'all'; // 'all' ou nom du client
  let filterDate = 'recent'; // 'recent', 'oldest', 'this_month', 'this_year'
  let showArchived = localStorage.getItem('manticore_show_archived_v1') === 'true';
  let searchQuery = '';
  let autoSaveTimeout = null;

  const COLOR_PRESETS = [
    '#38bdf8', // Bleu ciel
    '#818cf8', // Indigo
    '#a855f7', // Violet
    '#ec4899', // Rose
    '#f43f5e', // Rouge framboise
    '#f59e0b', // Ambre
    '#10b981', // Émeraude
    '#14b8a6'  // Cyan menthe
  ];

  // Références DOM
  const appSidebar = document.getElementById('appSidebar');
  const sidebarResizer = document.getElementById('sidebarResizer');
  const docsListEl = document.getElementById('docsList');
  const a4PageContainer = document.getElementById('a4PageContainer');
  const docLinkBannerContainer = document.getElementById('docLinkBannerContainer');
  const searchInput = document.getElementById('searchInput');
  const filterTabs = document.querySelectorAll('.tab-btn');
  const filterStatusSelect = document.getElementById('filterStatusSelect');
  const filterProjectSelect = document.getElementById('filterProjectSelect');
  const filterDateSelect = document.getElementById('filterDateSelect');
  const filterClientSelect = document.getElementById('filterClientSelect');
  const btnResetFilters = document.getElementById('btnResetFilters');
  const btnToggleArchived = document.getElementById('btnToggleArchived');
  const toggleArchivedText = document.getElementById('toggleArchivedText');
  const btnCreateMain = document.getElementById('btnCreateMain');
  const createMenu = document.getElementById('createMenu');

  // Modales
  const modalNewDocPrompt = document.getElementById('modalNewDocPrompt');
  const modalRenameProject = document.getElementById('modalRenameProject');
  const modalTemplates = document.getElementById('modalTemplates');
  const modalProfile = document.getElementById('modalProfile');
  const modalClients = document.getElementById('modalClients');
  const modalBackup = document.getElementById('modalBackup');
  const modalLinkDocument = document.getElementById('modalLinkDocument');
  const toastContainer = document.getElementById('toastContainer');

  // Contrôles Navigation Mobile / Tablette
  const btnToggleMobileSidebar = document.getElementById('btnToggleMobileSidebar');
  const btnCloseMobileSidebar = document.getElementById('btnCloseMobileSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  function openMobileSidebar() {
    if (appSidebar) appSidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('open');
  }

  function closeMobileSidebar() {
    if (appSidebar) appSidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('open');
  }

  if (btnToggleMobileSidebar) {
    btnToggleMobileSidebar.addEventListener('click', () => {
      if (appSidebar && appSidebar.classList.contains('open')) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    });
  }

  if (btnCloseMobileSidebar) {
    btnCloseMobileSidebar.addEventListener('click', closeMobileSidebar);
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileSidebar);
  }

  // ==========================================================================
  // GESTION DU REDIMENSIONNEMENT DE LA BARRE LATÉRALE (SOURIS & TACTILE)
  // ==========================================================================
  const savedSidebarWidth = localStorage.getItem('manticore_sidebar_width');
  if (savedSidebarWidth && appSidebar && window.innerWidth > 640) {
    const maxWidth = Math.min(window.innerWidth * 0.9, 750);
    const w = Math.max(250, Math.min(parseInt(savedSidebarWidth, 10), maxWidth));
    appSidebar.style.width = `${w}px`;
  }

  if (sidebarResizer && appSidebar) {
    let isResizing = false;
    let startX = 0;
    let startWidth = 360;

    const startResize = (clientX) => {
      if (window.innerWidth <= 640) return; // Sur mobile, la sidebar prend 100% de l'écran
      isResizing = true;
      startX = clientX;
      startWidth = appSidebar.getBoundingClientRect().width;
      sidebarResizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const doResize = (clientX) => {
      if (!isResizing || window.innerWidth <= 640) return;
      const diff = clientX - startX;
      const maxWidth = Math.min(window.innerWidth * 0.9, 750);
      const newWidth = Math.max(250, Math.min(startWidth + diff, maxWidth));
      appSidebar.style.width = `${newWidth}px`;
    };

    const stopResize = () => {
      if (isResizing) {
        isResizing = false;
        sidebarResizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const currentW = parseInt(appSidebar.style.width, 10);
        if (!isNaN(currentW)) {
          localStorage.setItem('manticore_sidebar_width', currentW);
        }
      }
    };

    // Événements Souris
    sidebarResizer.addEventListener('mousedown', (e) => startResize(e.clientX));
    document.addEventListener('mousemove', (e) => doResize(e.clientX));
    document.addEventListener('mouseup', stopResize);

    // Événements Tactiles (Tablettes)
    sidebarResizer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) startResize(e.touches[0].clientX);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (isResizing && e.touches.length === 1) doResize(e.touches[0].clientX);
    }, { passive: true });
    document.addEventListener('touchend', stopResize);
  }

  /**
   * Auto-ajuste la hauteur d'un champ textarea selon son contenu
   */
  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
  }

  /**
   * Affiche un message Toast
   */
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = '✓';
    if (type === 'info') icon = 'ℹ';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Sauvegarde le document actif avec debouncing
   */
  function triggerAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      if (activeDoc) {
        Store.saveDoc(activeDoc);
        renderSidebar();
        renderLinkBanner();
      }
    }, 400);
  }

  /**
   * Met à jour en direct les totaux affichés dans la page A4 sans détruire le DOM
   */
  function updateTotalsLive() {
    if (!activeDoc) return;
    const totals = Calculations.calculateDocumentTotals(activeDoc);
    
    const totalHTEl = document.getElementById('summaryTotalHT');
    const totalTVAEl = document.getElementById('summaryTotalTVA');
    const totalTTCEl = document.getElementById('summaryTotalTTC');
    const acompteValEl = document.getElementById('summaryAcompteMontant');
    const soldeValEl = document.getElementById('summarySoldeMontant');
    const soldePctEl = document.getElementById('summarySoldePercent');

    if (totalHTEl) totalHTEl.textContent = totals.formatted.totalHT;
    if (totalTVAEl) totalTVAEl.textContent = totals.formatted.totalTVA;
    if (totalTTCEl) totalTTCEl.textContent = totals.formatted.totalTTC;
    if (acompteValEl) acompteValEl.textContent = totals.formatted.acompteMontant;
    if (soldeValEl) soldeValEl.textContent = totals.formatted.soldeMontant;
    if (soldePctEl) soldePctEl.textContent = `(${totals.soldePercent}%)`;
  }

  /**
   * Sélectionne un document actif
   */
  function selectDocument(docId) {
    const doc = Store.getDoc(docId);
    if (!doc) {
      const all = Store.getAllDocs();
      if (all.length > 0) {
        selectDocument(all[0].id);
      } else {
        openNewDocModal('devis');
      }
      return;
    }

    activeDoc = JSON.parse(JSON.stringify(doc));
    Store.setActiveDocId(doc.id);
    renderSidebar();
    renderActiveDocument();

    // Sur tablette/mobile, fermer le tiroir automatiquement
    if (window.innerWidth <= 992) {
      closeMobileSidebar();
    }
  }

  // ==========================================================================
  // MODALE CRÉATION NOUVEAU DOCUMENT AVEC PROJET REQUIS, COULEUR ET UNICITÉ
  // ==========================================================================
  function openNewDocModal(type = 'devis', templateId = '') {
    const titleEl = document.getElementById('modalNewDocTitle');
    const typeHidden = document.getElementById('newDocTypeHidden');
    const templateHidden = document.getElementById('newDocTemplateHidden');
    const projectInput = document.getElementById('newDocProjectInput');
    const colorPicker = document.getElementById('newDocColorPicker');
    const presetsContainer = document.getElementById('newDocColorPresets');
    const chipsContainer = document.getElementById('existingProjectsChips');
    const validationMsg = document.getElementById('newDocValidationMsg');
    const confirmBtn = document.getElementById('btnConfirmCreateDoc');

    typeHidden.value = type;
    templateHidden.value = templateId || '';
    projectInput.value = '';
    projectInput.style.borderColor = '';
    colorPicker.value = '#38bdf8';
    validationMsg.innerHTML = '<span style="color:#94a3b8;">Tapez un nouveau nom unique ou choisissez un projet ci-dessous.</span>';
    confirmBtn.disabled = true;

    const typeNames = {
      'devis': 'Nouveau Devis',
      'facture': 'Nouvelle Facture',
      'facture_solde': 'Nouvelle Facture de Solde',
      'facture_acompte': 'Nouvelle Facture d\'Acompte'
    };
    titleEl.textContent = `📁 ${typeNames[type] || 'Nouveau Document'}`;

    // Rendu des presets de couleurs
    presetsContainer.innerHTML = COLOR_PRESETS.map(c => `
      <div class="color-preset-dot" style="background-color: ${c};" data-color="${c}" title="Choisir cette couleur"></div>
    `).join('');

    presetsContainer.querySelectorAll('.color-preset-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        colorPicker.value = dot.dataset.color;
        presetsContainer.querySelectorAll('.color-preset-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });

    // Validation en direct lors de la saisie au clavier du nom de projet
    projectInput.oninput = () => {
      const val = projectInput.value.trim().toUpperCase().replace(/\s+/g, '_');
      if (!val) {
        validationMsg.innerHTML = '<span style="color:#94a3b8;">Veuillez entrer un nom de projet.</span>';
        confirmBtn.disabled = true;
        projectInput.style.borderColor = '';
        return;
      }

      const isUnique = Store.isProjectNameUnique(val);
      if (!isUnique) {
        validationMsg.innerHTML = '<span style="color:#ef4444; font-weight:600;">❌ Ce projet existe déjà ! Pour y ajouter ce document, cliquez dessus dans la liste ci-dessous.</span>';
        confirmBtn.disabled = true;
        projectInput.style.borderColor = '#ef4444';
      } else {
        validationMsg.innerHTML = '<span style="color:#10b981; font-weight:600;">✓ Nouveau nom de projet disponible.</span>';
        confirmBtn.disabled = false;
        projectInput.style.borderColor = '#10b981';
      }
    };

    // Rendu des chips de projets existants pour sélection en 1 clic
    const existingProjects = Store.getDistinctProjects();
    if (existingProjects.length > 0) {
      chipsContainer.innerHTML = '<span style="font-size: 11px; color: #94a3b8; width: 100%; margin-bottom: 2px;">Ou rattacher à un projet existant :</span>' + existingProjects.map(p => `
        <button type="button" class="project-quick-chip" data-name="${escapeHtml(p.name)}" data-color="${p.color}">
          <span class="project-chip-color-dot" style="background-color: ${p.color};"></span>
          <span>${escapeHtml(p.name)}</span>
        </button>
      `).join('');

      chipsContainer.querySelectorAll('.project-quick-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          projectInput.value = btn.dataset.name;
          colorPicker.value = btn.dataset.color;
          validationMsg.innerHTML = `<span style="color:#38bdf8; font-weight:600;">📁 Rattachement au projet existant "${escapeHtml(btn.dataset.name)}"</span>`;
          projectInput.style.borderColor = '#38bdf8';
          confirmBtn.disabled = false;

          presetsContainer.querySelectorAll('.color-preset-dot').forEach(d => {
            if (d.dataset.color === btn.dataset.color) d.classList.add('active');
            else d.classList.remove('active');
          });
        });
      });
    } else {
      chipsContainer.innerHTML = '';
    }

    openModal(modalNewDocPrompt);
    setTimeout(() => projectInput.focus(), 50);
  }

  // Confirmation de création du document
  document.getElementById('btnConfirmCreateDoc')?.addEventListener('click', () => {
    const projectInput = document.getElementById('newDocProjectInput');
    const projectName = projectInput.value.trim().toUpperCase().replace(/\s+/g, '_');

    if (!projectName) {
      alert('Veuillez spécifier un Nom de Projet (requis pour créer le document).');
      projectInput.focus();
      return;
    }

    const type = document.getElementById('newDocTypeHidden').value;
    const templateId = document.getElementById('newDocTemplateHidden').value;
    const projectColor = document.getElementById('newDocColorPicker').value || '#38bdf8';

    const profile = Store.getProfile();
    const existingDocs = Store.getAllDocs();

    let template = null;
    if (templateId) {
      template = Store.getAllTemplatesCombined().find(t => t.id === templateId);
    }
    if (!template) {
      template = Templates.getBuiltinTemplates().find(t => t.type === type) || Templates.getBuiltinTemplates()[0];
    }

    const newDoc = Templates.createDocumentFromTemplate(template, {
      profile,
      existingDocs
    });

    newDoc.type = type;
    newDoc.prefix = projectName;
    newDoc.prefixColor = projectColor;
    newDoc.archived = false;

    // Si d'autres documents ont le même nom de projet, synchroniser leur couleur
    Store.updateProjectColor(projectName, projectColor);

    Store.saveDoc(newDoc);
    closeModal(modalNewDocPrompt);
    selectDocument(newDoc.id);
    showToast(`Document créé sous le projet "${projectName}" !`, 'success');
  });

  // ==========================================================================
  // MODALE MODIFIER LE PROJET (RENOMMAGE UNIQUE OU RATTACHEMENT EXISTANT)
  // ==========================================================================
  const btnOpenRenameModal = document.getElementById('btnOpenRenameModal');
  if (btnOpenRenameModal) {
    btnOpenRenameModal.addEventListener('click', () => {
      if (!activeDoc) return;
      const currentName = (activeDoc.prefix || '').trim().toUpperCase().replace(/\s+/g, '_');
      document.getElementById('renameProjectOldName').textContent = currentName || 'Sans nom';
      
      const newNameInput = document.getElementById('renameProjectNewNameInput');
      const validationMsg = document.getElementById('renameValidationMsg');
      const confirmBtn = document.getElementById('btnConfirmRenameProject');
      const reassignListEl = document.getElementById('reassignProjectsList');

      newNameInput.value = '';
      newNameInput.style.borderColor = '';
      validationMsg.innerHTML = '<span style="color:#94a3b8;">Tapez un nouveau nom unique pour renommer ce projet.</span>';
      confirmBtn.disabled = true;

      // Validation en temps réel de l'unicité
      newNameInput.oninput = () => {
        const val = newNameInput.value.trim().toUpperCase().replace(/\s+/g, '_');
        if (!val) {
          validationMsg.innerHTML = '<span style="color:#94a3b8;">Veuillez saisir un nom de projet.</span>';
          confirmBtn.disabled = true;
          newNameInput.style.borderColor = '';
          return;
        }

        if (val === currentName) {
          validationMsg.innerHTML = '<span style="color:#94a3b8;">Nom actuel inchangé.</span>';
          confirmBtn.disabled = true;
          newNameInput.style.borderColor = '';
          return;
        }

        const isUnique = Store.isProjectNameUnique(val, currentName);
        if (!isUnique) {
          validationMsg.innerHTML = '<span style="color:#ef4444; font-weight:600;">❌ Ce nom de projet existe déjà ! Pour y rattacher ce document, cliquez dessus ci-dessous.</span>';
          confirmBtn.disabled = true;
          newNameInput.style.borderColor = '#ef4444';
        } else {
          validationMsg.innerHTML = '<span style="color:#10b981; font-weight:600;">✓ Nom disponible pour le renommage.</span>';
          confirmBtn.disabled = false;
          newNameInput.style.borderColor = '#10b981';
        }
      };

      // Alimentation de la liste des autres projets existants pour rattachement rapide
      const allProjects = Store.getDistinctProjects();
      const otherProjects = allProjects.filter(p => p.name.toUpperCase() !== currentName);

      if (otherProjects.length === 0) {
        reassignListEl.innerHTML = '<div style="color:#64748b; font-size:11px; font-style:italic; padding:6px 0;">Aucun autre projet existant.</div>';
      } else {
        reassignListEl.innerHTML = otherProjects.map(p => `
          <div style="background:#0f172a; border:1px solid #334155; border-radius:6px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="project-chip-color-dot" style="background-color: ${p.color}; width:10px; height:10px;"></span>
              <div>
                <div style="font-weight:700; color:#f1f5f9; font-size:12.5px;">📁 ${escapeHtml(p.name)}</div>
                <div style="font-size:10.5px; color:#94a3b8;">${p.count} document${p.count > 1 ? 's' : ''} ${p.client ? '• ' + escapeHtml(p.client) : ''}</div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm btn-reassign-target" data-target="${escapeHtml(p.name)}" title="Rattacher ce document au projet ${escapeHtml(p.name)}">
              Rattacher
            </button>
          </div>
        `).join('');

        reassignListEl.querySelectorAll('.btn-reassign-target').forEach(btn => {
          btn.addEventListener('click', () => {
            const targetName = btn.dataset.target;
            Store.reassignDocProject(activeDoc.id, targetName);
            activeDoc = Store.getDoc(activeDoc.id);
            closeModal(modalRenameProject);
            renderActiveDocument();
            renderSidebar();
            showToast(`Document rattaché au projet "${targetName}" avec succès !`, 'success');
          });
        });
      }

      openModal(modalRenameProject);
      setTimeout(() => {
        newNameInput.focus();
      }, 50);
    });
  }

  // Confirmation de renommage unique
  document.getElementById('btnConfirmRenameProject')?.addEventListener('click', () => {
    if (!activeDoc) return;
    const oldName = activeDoc.prefix || '';
    const newNameInput = document.getElementById('renameProjectNewNameInput');
    const newName = newNameInput.value.trim().toUpperCase().replace(/\s+/g, '_');

    if (!newName) {
      alert('Veuillez saisir un nom de projet valide.');
      newNameInput.focus();
      return;
    }

    const res = Store.renameProject(oldName, newName);
    if (!res.success) {
      alert(res.error || 'Erreur lors du renommage du projet.');
      newNameInput.focus();
      return;
    }

    activeDoc.prefix = res.newName;
    closeModal(modalRenameProject);
    renderActiveDocument();
    renderSidebar();
    showToast(`Projet renommé "${res.newName}" (${res.count} document(s) actualisé(s)) !`, 'success');
  });

  /**
   * Retourne le code HTML de la pastille de statut
   */
  function getStatusBadgeHtml(status) {
    switch (status) {
      case 'envoye':
        return '<span class="status-pill status-pill-envoye">🔵 Envoyé</span>';
      case 'accepte':
        return '<span class="status-pill status-pill-accepte">🟢 Validé</span>';
      case 'paye':
        return '<span class="status-pill status-pill-paye">🟣 Payé</span>';
      case 'annule':
        return '<span class="status-pill status-pill-annule">🔴 Annulé</span>';
      case 'brouillon':
      default:
        return '<span class="status-pill status-pill-brouillon">🟡 Brouillon</span>';
    }
  }

  /**
   * Rempli le menu déroulant des projets dans les filtres
   */
  function updateProjectFilterOptions() {
    if (!filterProjectSelect) return;
    const currentVal = filterProjectSelect.value;
    const projects = Store.getDistinctProjects();

    projects.sort((a, b) => a.name.localeCompare(b.name));

    filterProjectSelect.innerHTML = '<option value="all">Projet : Tous</option>' + projects.map(p => {
      return `<option value="${escapeHtml(p.name)}">📁 ${escapeHtml(p.name)} (${p.count})</option>`;
    }).join('');

    if (currentVal && (currentVal === 'all' || projects.some(p => p.name === currentVal))) {
      filterProjectSelect.value = currentVal;
    }
  }

  /**
   * Rempli le menu déroulant des clients dans les filtres
   */
  function updateClientFilterOptions() {
    if (!filterClientSelect) return;
    const currentVal = filterClientSelect.value;
    const allDocs = Store.getAllDocs();
    const clients = Store.getClients();

    const distinctClients = new Set();
    allDocs.forEach(d => {
      if (d.client?.nom && d.client.nom.trim()) {
        distinctClients.add(d.client.nom.trim());
      }
    });
    clients.forEach(c => {
      if (c.nom && c.nom.trim()) {
        distinctClients.add(c.nom.trim());
      }
    });

    const sorted = Array.from(distinctClients).sort((a, b) => a.localeCompare(b));

    filterClientSelect.innerHTML = '<option value="all">Client : Tous</option>' + sorted.map(c => {
      return `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
    }).join('');

    if (currentVal && (currentVal === 'all' || sorted.includes(currentVal))) {
      filterClientSelect.value = currentVal;
    }
  }

  /**
   * Rendu de la barre latérale des documents avec filtres avancés et archives
   */
  function renderSidebar() {
    const allDocs = Store.getAllDocs();
    updateProjectFilterOptions();
    updateClientFilterOptions();
    docsListEl.innerHTML = '';

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const totalArchived = allDocs.filter(d => d.archived).length;
    if (toggleArchivedText) {
      toggleArchivedText.textContent = showArchived ? 'Masquer archivés' : `Archivés (${totalArchived})`;
    }
    if (btnToggleArchived) {
      btnToggleArchived.className = `btn btn-dark btn-sm toggle-archive-btn ${showArchived ? 'active' : ''}`;
    }

    let filtered = allDocs.filter(doc => {
      // Filtre d'archivage
      if (!showArchived && doc.archived) return false;
      if (showArchived && !doc.archived) return false;

      // Filtre par onglet type (Tous / Devis / Factures)
      if (activeFilter === 'devis' && !doc.type.startsWith('devis')) return false;
      if (activeFilter === 'facture' && !doc.type.startsWith('facture') && doc.type !== 'avoir') return false;

      // Filtre par statut
      if (filterStatus !== 'all') {
        const docStatus = doc.status || 'brouillon';
        if (docStatus !== filterStatus) return false;
      }

      // Filtre par projet
      if (filterProject !== 'all') {
        const docProj = (doc.prefix || '').trim().toUpperCase();
        if (docProj !== filterProject.trim().toUpperCase()) return false;
      }

      // Filtre par client
      if (filterClient !== 'all') {
        const docClient = (doc.client?.nom || '').trim();
        if (docClient.toLowerCase() !== filterClient.toLowerCase()) return false;
      }

      // Filtre par période
      if (filterDate === 'this_month' || filterDate === 'this_year') {
        const docISO = Nomenclature.formatDateToISO(doc.dateEmission);
        if (docISO) {
          const dDate = new Date(docISO);
          if (!isNaN(dDate.getTime())) {
            if (filterDate === 'this_year' && dDate.getFullYear() !== currentYear) {
              return false;
            }
            if (filterDate === 'this_month' && (dDate.getFullYear() !== currentYear || dDate.getMonth() !== currentMonth)) {
              return false;
            }
          }
        }
      }

      // Filtre par recherche
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const numMatch = (doc.numero || '').toLowerCase().includes(q);
        const prefixMatch = (doc.prefix || '').toLowerCase().includes(q);
        const clientMatch = (doc.client?.nom || '').toLowerCase().includes(q);
        const titleMatch = (doc.titreDoc || '').toLowerCase().includes(q);
        const linkedNumMatch = (doc.linkedDevisNumero || '').toLowerCase().includes(q);
        return numMatch || prefixMatch || clientMatch || titleMatch || linkedNumMatch;
      }
      return true;
    });

    // Tri par date
    filtered.sort((a, b) => {
      const dateA = new Date(Nomenclature.formatDateToISO(a.dateEmission) || a.createdAt || 0).getTime();
      const dateB = new Date(Nomenclature.formatDateToISO(b.dateEmission) || b.createdAt || 0).getTime();
      if (filterDate === 'oldest') {
        return dateA - dateB;
      }
      return dateB - dateA; // Récents d'abord par défaut
    });

    if (filtered.length === 0) {
      docsListEl.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 30px 10px; font-size: 13px;">
          ${showArchived ? 'Aucun document archivé trouvé' : 'Aucun document ne correspond aux filtres'}
        </div>
      `;
      return;
    }

    filtered.forEach(doc => {
      const card = document.createElement('div');
      card.className = `doc-card ${activeDoc && activeDoc.id === doc.id ? 'active' : ''} ${doc.archived ? 'is-archived' : ''}`;
      
      const totals = Calculations.calculateDocumentTotals(doc);
      const badgeClass = `badge-${doc.type || 'devis'}`;
      const dateDisplay = Nomenclature.formatDateToFR(doc.dateEmission);
      const statusBadge = doc.archived ? '<span class="status-pill status-pill-archived">📦 Archivé</span>' : getStatusBadgeHtml(doc.status);

      // Libellé très court pour le type de document
      let typeShortLabel = 'Devis';
      if (doc.type === 'facture_acompte') typeShortLabel = 'Acompte';
      else if (doc.type === 'facture_solde') typeShortLabel = 'Solde';
      else if (doc.type === 'facture') typeShortLabel = 'Facture';
      else if (doc.type === 'template') typeShortLabel = 'Modèle';

      // Calcul des liaisons pour affichage dans la carte
      let linkPill = '';
      if (doc.type.startsWith('devis')) {
        const linkedInvoices = Store.getLinkedInvoices(doc.id);
        if (linkedInvoices.length > 0) {
          linkPill = `<span class="doc-card-links-pill">🔗 ${linkedInvoices.length} fact.</span>`;
        }
      } else if (doc.linkedDevisNumero) {
        linkPill = `<span class="doc-card-links-pill">🔗 ${escapeHtml(doc.linkedDevisNumero)}</span>`;
      }

      // Couleur personnalisée du badge projet
      const pColor = doc.prefixColor || '#38bdf8';
      const prefixBadgeStyle = `background-color: ${pColor}26; color: ${pColor}; border: 1px solid ${pColor}66;`;

      card.innerHTML = `
        <div class="doc-card-row-1">
          <div class="doc-card-num-group">
            ${doc.prefix ? `<span class="doc-card-prefix" style="${prefixBadgeStyle}" title="Projet : ${escapeHtml(doc.prefix)}">${escapeHtml(doc.prefix)}</span>` : ''}
            <span class="doc-card-number" title="${escapeHtml(doc.numero || '')}">${doc.numero || 'Sans numéro'}</span>
          </div>
          <span class="doc-card-total">${totals.formatted.totalTTC}</span>
        </div>
        <div class="doc-card-row-2">
          <span class="doc-card-client" title="${escapeHtml(doc.client?.nom || 'Client non spécifié')}">${escapeHtml(doc.client?.nom || 'Client non spécifié')}</span>
          <div class="doc-card-badges-wrap">
            <span class="doc-card-badge ${badgeClass}">${typeShortLabel}</span>
            ${statusBadge}
          </div>
        </div>
        ${linkPill || dateDisplay ? `
          <div class="doc-card-row-3">
            ${linkPill ? linkPill : '<span></span>'}
            <span class="doc-card-date">${dateDisplay}</span>
          </div>
        ` : ''}
      `;

      card.addEventListener('click', () => {
        selectDocument(doc.id);
      });

      docsListEl.appendChild(card);
    });
  }

  /**
   * Ajuste la date du document actif à aujourd'hui
   */
  function setDocDateToToday() {
    if (!activeDoc) return;
    const todayISO = Nomenclature.getTodayISO();
    const todayFR = Nomenclature.formatDateToFR(todayISO);
    activeDoc.dateEmission = todayISO;

    const docDateInput = document.getElementById('docDateInput');
    if (docDateInput) docDateInput.value = todayISO;

    const printSpan = document.getElementById('docDateFormattedPrint');
    if (printSpan) printSpan.textContent = todayFR;

    const badgeContainer = document.getElementById('dateAlertBadgeContainer');
    if (badgeContainer) badgeContainer.innerHTML = '';

    triggerAutoSave();
    renderSidebar();
    showToast(`Date ajustée à aujourd'hui (${todayFR})`, 'info');
  }

  /**
   * Rendu de la bannière de liaison Devis <-> Factures
   */
  function renderLinkBanner() {
    if (!activeDoc || !docLinkBannerContainer) return;

    if (activeDoc.type.startsWith('devis')) {
      const linkedInvoices = Store.getLinkedInvoices(activeDoc.id);

      const pillsHtml = linkedInvoices.length > 0
        ? linkedInvoices.map(inv => {
            const invTotal = Calculations.calculateDocumentTotals(inv);
            const typeClass = inv.type === 'facture_acompte' ? 'pill-acompte' : inv.type === 'facture_solde' ? 'pill-solde' : 'pill-facture';
            const statusLabel = inv.status === 'paye' ? '🟢 Payé' : inv.status === 'envoye' ? '🔵 Envoyé' : '🟡 Brouillon';
            return `
              <button class="linked-doc-pill ${typeClass} btn-open-linked-doc" data-id="${inv.id}" title="Ouvrir cette facture">
                <span>${inv.numero || 'Facture'}</span>
                <span style="color:#94a3b8;">(${invTotal.formatted.totalTTC})</span>
                <span style="font-size:10px;">${statusLabel}</span>
              </button>
            `;
          }).join('')
        : '';

      docLinkBannerContainer.innerHTML = `
        <div class="doc-link-banner banner-devis no-print">
          <div class="clean-flow-header">
            <div class="clean-flow-title-wrap">
              <span class="clean-flow-icon">⚡</span>
              <span class="clean-flow-title">Facturer ce devis</span>
            </div>
            <span class="clean-flow-hint">Génération en 1 clic</span>
          </div>

          <div class="clean-flow-grid">
            <button class="clean-flow-btn" id="btnLinkedNewAcompte" title="Créer une facture d'acompte (40%) liée à ce devis">
              <span class="btn-flow-icon">⏳</span>
              <span class="btn-flow-text">Acompte <span class="btn-flow-sub">(40%)</span></span>
            </button>

            <button class="clean-flow-btn" id="btnLinkedNewSolde" title="Créer la facture finale de solde (acompte déduit)">
              <span class="btn-flow-icon">⚖️</span>
              <span class="btn-flow-text">Solde</span>
            </button>

            <button class="clean-flow-btn" id="btnLinkedNewStandard" title="Créer une facture intégrale standard (100%)">
              <span class="btn-flow-icon">💶</span>
              <span class="btn-flow-text">Facture <span class="btn-flow-sub">(100%)</span></span>
            </button>

            <button class="clean-flow-btn clean-flow-btn-assoc" id="btnLinkedLinkExisting" title="Associer une facture déjà existante à ce devis">
              <span class="btn-flow-icon">🔗</span>
              <span class="btn-flow-text">Associer...</span>
            </button>
          </div>

          ${linkedInvoices.length > 0 ? `
            <div class="linked-history-row">
              <span class="history-label">Factures créées (${linkedInvoices.length}) :</span>
              <div class="linked-pills-list">
                ${pillsHtml}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      // Attacher événements de la bannière Devis
      docLinkBannerContainer.querySelectorAll('.btn-open-linked-doc').forEach(btn => {
        btn.addEventListener('click', () => {
          selectDocument(btn.dataset.id);
        });
      });

      document.getElementById('btnLinkedNewAcompte')?.addEventListener('click', () => {
        const inv = Store.createInvoiceFromDevis(activeDoc.id, 'facture_acompte');
        if (inv) {
          selectDocument(inv.id);
          showToast(`Facture d'acompte ${inv.numero} créée et liée au devis !`, 'success');
        }
      });

      document.getElementById('btnLinkedNewSolde')?.addEventListener('click', () => {
        const inv = Store.createInvoiceFromDevis(activeDoc.id, 'facture_solde');
        if (inv) {
          selectDocument(inv.id);
          showToast(`Facture de solde ${inv.numero} créée avec déduction d'acompte !`, 'success');
        }
      });

      document.getElementById('btnLinkedNewStandard')?.addEventListener('click', () => {
        const inv = Store.createInvoiceFromDevis(activeDoc.id, 'facture');
        if (inv) {
          selectDocument(inv.id);
          showToast(`Facture ${inv.numero} créée et liée au devis !`, 'success');
        }
      });

      document.getElementById('btnLinkedLinkExisting')?.addEventListener('click', () => {
        openLinkModal('invoice_to_devis');
      });

    } else {
      // Pour une facture / facture d'acompte / facture de solde
      const linkedDevis = activeDoc.linkedDevisId ? Store.getDoc(activeDoc.linkedDevisId) : null;

      docLinkBannerContainer.innerHTML = `
        <div class="doc-link-banner banner-facture no-print">
          <div class="clean-flow-header">
            <div class="clean-flow-title-wrap">
              <span class="clean-flow-icon">🔗</span>
              <span class="clean-flow-title">Devis d'origine</span>
            </div>
          </div>

          <div class="clean-facture-origin-wrap">
            ${linkedDevis ? `
              <button class="linked-doc-pill pill-devis" id="btnOpenLinkedDevis" title="Ouvrir le devis d'origine">
                <span>📄 Devis ${escapeHtml(linkedDevis.numero)}</span>
                <span style="color:#94a3b8;">(${escapeHtml(linkedDevis.client?.nom || '')})</span>
                <span style="font-size:10px;">↗</span>
              </button>
              <div style="display: flex; gap: 4px;">
                <button class="btn btn-sm btn-dark" id="btnChangeLinkedDevis" title="Changer de devis">Remplacer</button>
                <button class="btn btn-sm btn-danger-outline" id="btnUnlinkDevis" title="Dissocier du devis">✕</button>
              </div>
            ` : `
              <span class="facture-solo-text">Facture autonome (non rattachée)</span>
              <button class="btn btn-sm btn-dark" id="btnChangeLinkedDevis">+ Lier à un devis</button>
            `}
          </div>
        </div>
      `;

      document.getElementById('btnOpenLinkedDevis')?.addEventListener('click', () => {
        if (activeDoc.linkedDevisId) {
          selectDocument(activeDoc.linkedDevisId);
        }
      });

      document.getElementById('btnChangeLinkedDevis')?.addEventListener('click', () => {
        openLinkModal('devis_to_invoice');
      });

      document.getElementById('btnUnlinkDevis')?.addEventListener('click', () => {
        if (confirm('Voulez-vous dissocier cette facture de son devis d\'origine ?')) {
          Store.unlinkInvoice(activeDoc.id);
          renderLinkBanner();
          renderSidebar();
          showToast('Facture dissociée du devis', 'info');
        }
      });
    }
  }

  /**
   * Modale d'association de documents
   */
  function openLinkModal(mode) {
    const listEl = document.getElementById('linkDocsList');
    const titleEl = document.getElementById('modalLinkTitle');
    const descEl = document.getElementById('modalLinkDesc');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (mode === 'invoice_to_devis') {
      titleEl.textContent = '🔗 Associer une facture au Devis';
      descEl.textContent = `Sélectionnez une facture existante à relier au devis ${activeDoc.numero} :`;

      const allInvoices = Store.getAllDocs().filter(d => !d.type.startsWith('devis') && d.id !== activeDoc.id);
      if (allInvoices.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:12px;">Aucune facture disponible.</p>';
      } else {
        allInvoices.forEach(inv => {
          const row = document.createElement('div');
          row.style.cssText = 'background:#0f172a; padding:10px 14px; border:1px solid #334155; border-radius:6px; display:flex; justify-content:space-between; align-items:center;';
          const invTotals = Calculations.calculateDocumentTotals(inv);
          const typeLabel = Nomenclature.DOC_TYPES[inv.type]?.label || 'Facture';

          row.innerHTML = `
            <div>
              <div style="font-weight:700; color:#fff; font-size:13px;">${escapeHtml(inv.numero)} <span style="font-size:11px; color:#94a3b8;">(${typeLabel})</span></div>
              <div style="color:#94a3b8; font-size:11px;">Client: ${escapeHtml(inv.client?.nom || '')} • Montant: ${invTotals.formatted.totalTTC}</div>
            </div>
            <button class="btn btn-primary btn-sm btn-select-link">Associer</button>
          `;

          row.querySelector('.btn-select-link').addEventListener('click', () => {
            Store.linkInvoiceToDevis(inv.id, activeDoc.id);
            closeModal(modalLinkDocument);
            renderLinkBanner();
            renderSidebar();
            showToast(`Facture ${inv.numero} reliée au devis !`, 'success');
          });

          listEl.appendChild(row);
        });
      }
    } else {
      titleEl.textContent = '🔗 Relier cette Facture à un Devis';
      descEl.textContent = `Sélectionnez le devis auquel rattacher la facture ${activeDoc.numero} :`;

      const allDevis = Store.getAllDevis();
      if (allDevis.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b; font-size:12px;">Aucun devis disponible.</p>';
      } else {
        allDevis.forEach(dev => {
          const row = document.createElement('div');
          row.style.cssText = 'background:#0f172a; padding:10px 14px; border:1px solid #334155; border-radius:6px; display:flex; justify-content:space-between; align-items:center;';
          const devTotals = Calculations.calculateDocumentTotals(dev);

          row.innerHTML = `
            <div>
              <div style="font-weight:700; color:#fff; font-size:13px;">Devis ${escapeHtml(dev.numero)}</div>
              <div style="color:#94a3b8; font-size:11px;">Client: ${escapeHtml(dev.client?.nom || '')} • Total: ${devTotals.formatted.totalTTC}</div>
            </div>
            <button class="btn btn-primary btn-sm btn-select-link">Choisir ce devis</button>
          `;

          row.querySelector('.btn-select-link').addEventListener('click', () => {
            Store.linkInvoiceToDevis(activeDoc.id, dev.id);
            activeDoc.linkedDevisId = dev.id;
            activeDoc.linkedDevisNumero = dev.numero;
            closeModal(modalLinkDocument);
            renderLinkBanner();
            renderSidebar();
            showToast(`Facture rattachée au devis ${dev.numero} !`, 'success');
          });

          listEl.appendChild(row);
        });
      }
    }

    openModal(modalLinkDocument);
  }

  /**
   * Rendu complet du document A4 actif
   */
  function renderActiveDocument() {
    if (!activeDoc) return;

    // Rendu de la bannière de liaison projet
    renderLinkBanner();

    // Calcul des totaux
    const totals = Calculations.calculateDocumentTotals(activeDoc);
    
    // Normalisation de la date en ISO (YYYY-MM-DD) pour l'input natif
    const dateISO = Nomenclature.formatDateToISO(activeDoc.dateEmission);
    const dateFR = Nomenclature.formatDateToFR(dateISO);
    const dateCheck = Nomenclature.checkIsToday(dateISO);

    // Synchronisation de la barre d'action supérieure
    const statusSelect = document.getElementById('statusSelect');
    if (statusSelect) statusSelect.value = activeDoc.status || 'brouillon';

    const docCurrencySelect = document.getElementById('docCurrencySelect');
    if (docCurrencySelect) docCurrencySelect.value = activeDoc.devise || '€';

    const currency = activeDoc.devise || '€';

    const docPrefixText = document.getElementById('docPrefixText');
    if (docPrefixText) docPrefixText.textContent = activeDoc.prefix || 'PROJET';

    const docProjectColorInput = document.getElementById('docProjectColorInput');
    if (docProjectColorInput) docProjectColorInput.value = activeDoc.prefixColor || '#38bdf8';

    // Synchronisation du bouton d'archivage
    const archiveDocText = document.getElementById('archiveDocText');
    const archiveDocIcon = document.getElementById('archiveDocIcon');
    if (archiveDocText) archiveDocText.textContent = activeDoc.archived ? 'Désarchiver ce document' : 'Archiver ce document';
    if (archiveDocIcon) archiveDocIcon.textContent = activeDoc.archived ? '📂' : '📦';

    // Synchronisation de l'onglet flottant
    const floatingToggleBadge = document.getElementById('floatingToggleBadge');
    if (floatingToggleBadge) {
      floatingToggleBadge.innerHTML = activeDoc.archived
        ? '📦 Archivé'
        : getStatusBadgeHtml(activeDoc.status || 'brouillon');
    }

    const toggleBankBtn = document.getElementById('toggleBankBtn');
    if (toggleBankBtn) {
      toggleBankBtn.className = `toggle-btn ${activeDoc.showBanque ? 'active' : ''}`;
    }

    const toggleAcompteBtn = document.getElementById('toggleAcompteBtn');
    if (toggleAcompteBtn) {
      toggleAcompteBtn.className = `toggle-btn ${activeDoc.showAcompteSolde ? 'active' : ''}`;
    }

    const toggleSigBtn = document.getElementById('toggleSigBtn');
    if (toggleSigBtn) {
      toggleSigBtn.className = `toggle-btn ${activeDoc.showSignature ? 'active' : ''}`;
    }

    // Construction HTML de la page A4
    a4PageContainer.innerHTML = `
      <div class="a4-page" id="printableA4Document">
        
        <!-- Haut de page : Titre & Numérotation -->
        <div class="doc-top-section">
          <input type="text" class="doc-title-input" id="docTitleInput" value="${escapeHtml(activeDoc.titreDoc || 'Devis')}" placeholder="Titre du document" />
          
          <div class="doc-meta-grid">
            <div class="doc-meta-row">
              <input type="text" class="doc-meta-label" id="docLabelNumInput" value="${escapeHtml(activeDoc.labelNumero || 'Numéro de devis')}" />
              <input type="text" class="doc-meta-value" id="docNumInput" value="${escapeHtml(activeDoc.numero || '')}" placeholder="D-20260827_01" />
            </div>
            
            <div class="doc-meta-row" id="docMetaDateRow">
              <input type="text" class="doc-meta-label" id="docLabelDateInput" value="${escapeHtml(activeDoc.labelDate || 'Date d\'émission')}" />
              <div style="display: flex; align-items: center; gap: 6px;">
                <!-- Vrai input de date natif pour édition -->
                <input type="date" class="doc-date-native-input no-print" id="docDateInput" value="${dateISO}" />
                
                <!-- Texte de date français pour l'impression / PDF -->
                <span class="doc-date-formatted-print" id="docDateFormattedPrint">${dateFR}</span>

                <!-- Badge dynamique d'alerte -->
                <span id="dateAlertBadgeContainer">
                  ${!dateCheck.isToday ? `
                    <span class="date-alert-badge no-print" title="La date indiquée ne correspond pas à aujourd'hui">
                      ⚠️ ≠ ${dateCheck.todayStrFR}
                      <button class="date-alert-btn" id="btnSetTodayDate">Aujourd'hui</button>
                    </span>
                  ` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Coordonnées Émetteur & Client -->
        <div class="doc-parties-grid">
          <!-- Émetteur -->
          <div class="party-block">
            <input type="text" class="party-name" id="emetteurNom" value="${escapeHtml(activeDoc.emetteur?.nom || '')}" placeholder="Votre Nom / Entreprise" />
            <input type="text" class="party-line" id="emetteurLigne1" value="${escapeHtml(activeDoc.emetteur?.ligne1 || '')}" placeholder="Adresse ligne 1" />
            <input type="text" class="party-line" id="emetteurLigne2" value="${escapeHtml(activeDoc.emetteur?.ligne2 || '')}" placeholder="Code postal & Ville" />
            <input type="text" class="party-line" id="emetteurEmail" value="${escapeHtml(activeDoc.emetteur?.email || '')}" placeholder="votre.email@domaine.fr" />
          </div>

          <!-- Client -->
          <div class="party-block">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <input type="text" class="party-name" id="clientNom" value="${escapeHtml(activeDoc.client?.nom || '')}" placeholder="Nom du Client" />
              <button class="btn btn-sm btn-dark no-print" id="btnPickClient" title="Choisir un client enregistré" style="padding: 1px 6px; font-size: 10px;">Carnet ▾</button>
            </div>
            <input type="text" class="party-line" id="clientLigne1" value="${escapeHtml(activeDoc.client?.adresse1 || '')}" placeholder="Adresse du client" />
            <input type="text" class="party-line" id="clientLigne2" value="${escapeHtml(activeDoc.client?.adresse2 || '')}" placeholder="Code postal, Ville" />
            <input type="text" class="party-line" id="clientEmail" value="${escapeHtml(activeDoc.client?.email || '')}" placeholder="Email du client (optionnel)" />
          </div>
        </div>

        <!-- Tableau des prestations -->
        <div class="doc-items-container">
          <table class="doc-items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="col-qty">Qté</th>
                <th class="col-price">Prix unitaire (${currency})</th>
                <th class="col-tva">TVA (%)</th>
                <th class="col-total">Total HT (${currency})</th>
                <th class="col-actions no-print"></th>
              </tr>
            </thead>
            <tbody id="itemsTableBody">
              ${(activeDoc.items || []).map((item, idx) => {
                const lineCalc = Calculations.calculateLine(item);
                return `
                  <tr data-index="${idx}">
                    <td>
                      <textarea class="item-desc-input no-print-view" rows="1" placeholder="Description de la prestation...">${escapeHtml(item.description || '')}</textarea>
                      <div class="item-desc-print">${escapeHtml(item.description || '')}</div>
                    </td>
                    <td class="col-qty">
                      <input type="text" class="item-qty-input" value="${escapeHtml(String(item.qte || '1'))}" />
                    </td>
                    <td class="col-price">
                      <input type="text" class="item-price-input" value="${escapeHtml(String(item.prixUnitaire !== undefined ? item.prixUnitaire : '0'))}" />
                    </td>
                    <td class="col-tva">
                      <input type="text" class="item-tva-input" value="${escapeHtml(String(item.tva !== undefined ? item.tva : '0'))}%" />
                    </td>
                    <td class="col-total">
                      ${lineCalc.totalHT.toFixed(2).replace('.', ',')}
                    </td>
                    <td class="col-actions no-print">
                      <button class="row-actions-btn btn-delete-row" data-index="${idx}" title="Supprimer la ligne">✕</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <button class="btn-add-item no-print" id="btnAddRow">
            <span>+</span> Ajouter une ligne de prestation
          </button>
        </div>

        <!-- Totaux avec lignes pointillées -->
        <div class="doc-totals-wrapper">
          <div class="doc-totals-table">
            <div class="total-line">
              <span class="total-label">Total HT</span>
              <span class="total-dots"></span>
              <span class="total-value" id="summaryTotalHT">${totals.formatted.totalHT}</span>
            </div>

            <div class="total-line">
              <span class="total-label">Montant total de la TVA</span>
              <span class="total-dots"></span>
              <span class="total-value" id="summaryTotalTVA">${totals.formatted.totalTVA}</span>
            </div>

            <div class="total-line bold">
              <span class="total-label">Total TTC</span>
              <span class="total-dots"></span>
              <span class="total-value" id="summaryTotalTTC">${totals.formatted.totalTTC}</span>
            </div>

            ${activeDoc.showAcompteSolde ? `
              <div class="total-line">
                <span class="total-label">
                  <input type="text" class="label-acompte-input" id="labelAcompteInput" value="${escapeHtml(activeDoc.labelAcompte || 'Acompte à la commande')}" placeholder="Acompte" /> 
                  (<input type="number" class="percent-acompte-input" id="percentAcompteInput" value="${activeDoc.acomptePercent !== undefined ? activeDoc.acomptePercent : 40}" />%)
                </span>
                <span class="total-dots"></span>
                <span class="total-value" id="summaryAcompteMontant">${totals.formatted.acompteMontant}</span>
              </div>

              <div class="total-line">
                <span class="total-label">
                  <input type="text" class="label-solde-input" id="labelSoldeInput" value="${escapeHtml(activeDoc.labelSolde || 'Solde à la livraison')}" placeholder="Solde" />
                  <span id="summarySoldePercent">(${totals.soldePercent}%)</span>
                </span>
                <span class="total-dots"></span>
                <span class="total-value" id="summarySoldeMontant">${totals.formatted.soldeMontant}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Coordonnées Bancaires (Optionnel) -->
        ${activeDoc.showBanque ? `
          <div class="doc-bank-container">
            <table class="doc-bank-table">
              <thead>
                <tr>
                  <th class="col-bank-titulaire">Titulaire du compte</th>
                  <th class="col-bank-nom">Banque</th>
                  <th class="col-bank-iban">IBAN</th>
                  <th class="col-bank-bic">BIC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <input type="text" class="no-print-view" id="bankTitulaire" value="${escapeHtml(activeDoc.banque?.titulaire || '')}" placeholder="Nom titulaire" style="width: 100%;" />
                    <div class="bank-print-val bank-val-wrap" id="printBankTitulaire">${escapeHtml(activeDoc.banque?.titulaire || '')}</div>
                  </td>
                  <td>
                    <input type="text" class="no-print-view" id="bankNom" value="${escapeHtml(activeDoc.banque?.banque || '')}" placeholder="Nom de banque" style="width: 100%;" />
                    <div class="bank-print-val bank-val-wrap" id="printBankNom">${escapeHtml(activeDoc.banque?.banque || '')}</div>
                  </td>
                  <td>
                    <input type="text" class="no-print-view" id="bankIban" value="${escapeHtml(activeDoc.banque?.iban || '')}" placeholder="FR76..." style="width: 100%; font-weight: 600; letter-spacing: 0.3px;" />
                    <div class="bank-print-val bank-val-nowrap" id="printBankIban" style="font-weight: 600; letter-spacing: 0.3px;">${escapeHtml(activeDoc.banque?.iban || '')}</div>
                  </td>
                  <td>
                    <input type="text" class="no-print-view" id="bankBic" value="${escapeHtml(activeDoc.banque?.bic || '')}" placeholder="BIC / SWIFT" style="width: 100%;" />
                    <div class="bank-print-val bank-val-nowrap" id="printBankBic">${escapeHtml(activeDoc.banque?.bic || '')}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- Clauses, Notes & Mentions Légales -->
        <div class="doc-clauses-container">
          ${(activeDoc.clauses || []).map((clause, idx) => `
            <div class="clause-item">
              <textarea class="clause-input no-print-view" rows="1" data-index="${idx}">${escapeHtml(clause)}</textarea>
              <div class="clause-text-print">${escapeHtml(clause)}</div>
              <button class="btn-remove-clause no-print" data-index="${idx}" title="Supprimer cette clause">✕</button>
            </div>
          `).join('')}

          <div style="display: flex; gap: 8px;" class="no-print">
            <button class="btn-add-clause" id="btnAddClause">+ Ajouter une clause</button>
            <button class="btn-add-clause" id="btnQuickClauses">📜 Mentions types ▾</button>
          </div>
        </div>

        <!-- Bloc Signature (Optionnel pour Devis) -->
        ${activeDoc.showSignature ? `
          <div class="doc-signature-container">
            <input type="text" class="signature-title" id="signatureTitleInput" value="${escapeHtml(activeDoc.signatureText || 'Bon pour accord, date et signature du client :')}" style="width: 100%;" />
          </div>
        ` : ''}

        <!-- Pied de page -->
        <div class="doc-footer-section">
          <input type="text" class="doc-footer-text" id="footerTextInput" value="${escapeHtml(activeDoc.basDePage || '')}" placeholder="Mentions légales, SIRET, statut freelance..." />
        </div>

      </div>
    `;

    // Ajustement automatique de la hauteur de tous les textareas
    setTimeout(() => {
      document.querySelectorAll('#printableA4Document textarea').forEach(autoResizeTextarea);
    }, 10);

    attachDocumentEventListeners();
  }

  /**
   * Attache tous les écouteurs de modification sur la page A4 active
   */
  function attachDocumentEventListeners() {
    // Bouton mettre la date à aujourd'hui
    const btnSetToday = document.getElementById('btnSetTodayDate');
    if (btnSetToday) {
      btnSetToday.addEventListener('click', setDocDateToToday);
    }

    // Input natif de Date
    const docDateInput = document.getElementById('docDateInput');
    if (docDateInput) {
      const updateDateHandler = () => {
        const val = docDateInput.value;
        if (!val) return;
        
        activeDoc.dateEmission = val;

        // Mise à jour du texte de date formaté français
        const printSpan = document.getElementById('docDateFormattedPrint');
        if (printSpan) {
          printSpan.textContent = Nomenclature.formatDateToFR(val);
        }

        // Vérification dynamique immédiate : est-ce aujourd'hui ?
        const check = Nomenclature.checkIsToday(val);
        const badgeContainer = document.getElementById('dateAlertBadgeContainer');
        if (badgeContainer) {
          if (!check.isToday) {
            badgeContainer.innerHTML = `
              <span class="date-alert-badge no-print" title="La date indiquée ne correspond pas à aujourd'hui">
                ⚠️ ≠ ${check.todayStrFR}
                <button class="date-alert-btn" id="btnSetTodayDateDynamic">Aujourd'hui</button>
              </span>
            `;
            const dynamicBtn = document.getElementById('btnSetTodayDateDynamic');
            if (dynamicBtn) {
              dynamicBtn.addEventListener('click', setDocDateToToday);
            }
          } else {
            badgeContainer.innerHTML = '';
          }
        }

        triggerAutoSave();
        renderSidebar();
      };

      docDateInput.addEventListener('input', updateDateHandler);
      docDateInput.addEventListener('change', updateDateHandler);
    }

    // Titre & Métadonnées
    bindInput('docTitleInput', (val) => activeDoc.titreDoc = val);
    bindInput('docLabelNumInput', (val) => activeDoc.labelNumero = val);
    bindInput('docNumInput', (val) => activeDoc.numero = val);
    bindInput('docLabelDateInput', (val) => activeDoc.labelDate = val);

    // Émetteur
    bindInput('emetteurNom', (val) => activeDoc.emetteur.nom = val);
    bindInput('emetteurLigne1', (val) => activeDoc.emetteur.ligne1 = val);
    bindInput('emetteurLigne2', (val) => activeDoc.emetteur.ligne2 = val);
    bindInput('emetteurEmail', (val) => activeDoc.emetteur.email = val);

    // Client
    bindInput('clientNom', (val) => activeDoc.client.nom = val);
    bindInput('clientLigne1', (val) => activeDoc.client.adresse1 = val);
    bindInput('clientLigne2', (val) => activeDoc.client.adresse2 = val);
    bindInput('clientEmail', (val) => activeDoc.client.email = val);

    // Choisir un client depuis le carnet
    const btnPickClient = document.getElementById('btnPickClient');
    if (btnPickClient) {
      btnPickClient.addEventListener('click', openClientsModal);
    }

    // Lignes de tableau avec saisie fluide SANS perte de focus
    const tableBody = document.getElementById('itemsTableBody');
    if (tableBody) {
      tableBody.querySelectorAll('tr').forEach(row => {
        const idx = parseInt(row.dataset.index, 10);
        const item = activeDoc.items[idx];
        if (!item) return;

        const descInput = row.querySelector('.item-desc-input');
        const descPrint = row.querySelector('.item-desc-print');
        const qtyInput = row.querySelector('.item-qty-input');
        const priceInput = row.querySelector('.item-price-input');
        const tvaInput = row.querySelector('.item-tva-input');
        const totalCell = row.querySelector('.col-total');

        if (descInput) {
          autoResizeTextarea(descInput);
          descInput.addEventListener('input', (e) => {
            autoResizeTextarea(e.target);
            item.description = e.target.value;
            if (descPrint) descPrint.textContent = e.target.value;
            triggerAutoSave();
          });
        }

        if (qtyInput) {
          qtyInput.addEventListener('input', (e) => {
            item.qte = e.target.value;
            const lineCalc = Calculations.calculateLine(item);
            if (totalCell) totalCell.textContent = lineCalc.totalHT.toFixed(2).replace('.', ',');
            updateTotalsLive();
            triggerAutoSave();
          });
        }

        if (priceInput) {
          priceInput.addEventListener('input', (e) => {
            item.prixUnitaire = Calculations.parseAmount(e.target.value);
            const lineCalc = Calculations.calculateLine(item);
            if (totalCell) totalCell.textContent = lineCalc.totalHT.toFixed(2).replace('.', ',');
            updateTotalsLive();
            triggerAutoSave();
          });
        }

        if (tvaInput) {
          tvaInput.addEventListener('input', (e) => {
            item.tva = Calculations.parseAmount(e.target.value);
            const lineCalc = Calculations.calculateLine(item);
            if (totalCell) totalCell.textContent = lineCalc.totalHT.toFixed(2).replace('.', ',');
            updateTotalsLive();
            triggerAutoSave();
          });
        }
      });
    }

    // Boutons de suppression de ligne
    document.querySelectorAll('.btn-delete-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        activeDoc.items.splice(idx, 1);
        Store.saveDoc(activeDoc);
        renderActiveDocument();
      });
    });

    // Ajouter une ligne
    const btnAddRow = document.getElementById('btnAddRow');
    if (btnAddRow) {
      btnAddRow.addEventListener('click', () => {
        activeDoc.items.push({
          id: 'item_' + Date.now(),
          description: '',
          qte: '1',
          prixUnitaire: 0,
          tva: 0
        });
        Store.saveDoc(activeDoc);
        renderActiveDocument();
      });
    }

    // Acompte & Solde inputs
    bindInput('labelAcompteInput', (val) => activeDoc.labelAcompte = val);
    bindInput('labelSoldeInput', (val) => activeDoc.labelSolde = val);
    const percentAcompteInput = document.getElementById('percentAcompteInput');
    if (percentAcompteInput) {
      percentAcompteInput.addEventListener('input', (e) => {
        activeDoc.acomptePercent = parseFloat(e.target.value) || 0;
        updateTotalsLive();
        triggerAutoSave();
      });
    }

    // Banque inputs avec synchronisation affichage d'impression
    bindInput('bankTitulaire', (val) => {
      activeDoc.banque.titulaire = val;
      const el = document.getElementById('printBankTitulaire');
      if (el) el.textContent = val;
    });
    bindInput('bankNom', (val) => {
      activeDoc.banque.banque = val;
      const el = document.getElementById('printBankNom');
      if (el) el.textContent = val;
    });
    bindInput('bankIban', (val) => {
      activeDoc.banque.iban = val;
      const el = document.getElementById('printBankIban');
      if (el) el.textContent = val;
    });
    bindInput('bankBic', (val) => {
      activeDoc.banque.bic = val;
      const el = document.getElementById('printBankBic');
      if (el) el.textContent = val;
    });

    // Clauses inputs avec auto-resize et synchronisation impression
    document.querySelectorAll('.clause-item').forEach(itemEl => {
      const textarea = itemEl.querySelector('.clause-input');
      const textPrint = itemEl.querySelector('.clause-text-print');
      const idx = parseInt(textarea.dataset.index, 10);

      autoResizeTextarea(textarea);
      textarea.addEventListener('input', (e) => {
        autoResizeTextarea(e.target);
        activeDoc.clauses[idx] = e.target.value;
        if (textPrint) textPrint.textContent = e.target.value;
        triggerAutoSave();
      });
    });

    // Supprimer une clause
    document.querySelectorAll('.btn-remove-clause').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        activeDoc.clauses.splice(idx, 1);
        Store.saveDoc(activeDoc);
        renderActiveDocument();
      });
    });

    // Ajouter une clause
    const btnAddClause = document.getElementById('btnAddClause');
    if (btnAddClause) {
      btnAddClause.addEventListener('click', () => {
        if (!activeDoc.clauses) activeDoc.clauses = [];
        activeDoc.clauses.push('Nouvelle clause ou condition...');
        Store.saveDoc(activeDoc);
        renderActiveDocument();
      });
    }

    // Mentions types rapides
    const btnQuickClauses = document.getElementById('btnQuickClauses');
    if (btnQuickClauses) {
      btnQuickClauses.addEventListener('click', () => {
        const choices = [
          'TVA non applicable, article 293 B du Code Général des Impôts.',
          'Conditions de paiement : Paiement à réception de facture (ou sous 30 jours). En cas de retard de paiement, des pénalités de retard calculées au taux annuel de 10 % seront exigibles de plein droit. Conformément à l\'article D.441-5 du Code de commerce, une indemnité forfaitaire pour frais de recouvrement de 40 € sera également due.',
          'Devis valable 30 jours.',
          'Le début de l\'exécution de la prestation est conditionné par la réception du devis signé et le paiement de l\'acompte.',
          '2 feedbacks compris dans le total TTC, ensuite facturation en fonction de la hauteur des retours.'
        ];
        
        const clauseToAdd = prompt('Choisir une mention légale à ajouter :\n\n1. TVA non applicable 293 B\n2. Pénalités de retard 10% + 40€\n3. Devis valable 30 jours\n4. Début prestation conditionné à acompte\n5. Feedbacks inclus\n\n(Tapez 1, 2, 3, 4 ou 5) :');
        if (clauseToAdd && choices[parseInt(clauseToAdd) - 1]) {
          activeDoc.clauses.push(choices[parseInt(clauseToAdd) - 1]);
          Store.saveDoc(activeDoc);
          renderActiveDocument();
          showToast('Mention légale ajoutée', 'info');
        }
      });
    }

    // Signature
    bindInput('signatureTitleInput', (val) => activeDoc.signatureText = val);

    // Pied de page
    bindInput('footerTextInput', (val) => activeDoc.basDePage = val);
  }

  function bindInput(id, callback) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        callback(e.target.value);
        triggerAutoSave();
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- ACTIONS SUR LE DOCUMENT ACTIF ---
  // Modification de la couleur du projet
  const docProjectColorInput = document.getElementById('docProjectColorInput');
  if (docProjectColorInput) {
    docProjectColorInput.addEventListener('input', (e) => {
      if (activeDoc) {
        activeDoc.prefixColor = e.target.value;
        if (activeDoc.prefix) {
          Store.updateProjectColor(activeDoc.prefix, activeDoc.prefixColor);
        }
        triggerAutoSave();
        renderSidebar();
      }
    });
  }

  // Archivage / Désarchivage du document actif
  const btnArchiveDoc = document.getElementById('btnArchiveDoc');
  if (btnArchiveDoc) {
    btnArchiveDoc.addEventListener('click', () => {
      docOptionsMenu?.classList.remove('show');
      if (!activeDoc) return;
      activeDoc.archived = !activeDoc.archived;
      Store.saveDoc(activeDoc);
      renderSidebar();
      renderActiveDocument();
      showToast(activeDoc.archived ? `Document "${activeDoc.numero}" archivé 📦` : `Document "${activeDoc.numero}" désarchivé 📂`, 'info');
    });
  }

  // Statut
  const statusSelect = document.getElementById('statusSelect');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      if (activeDoc) {
        activeDoc.status = e.target.value;
        Store.saveDoc(activeDoc);
        renderSidebar();
        renderLinkBanner();
        showToast(`Statut mis à jour : ${e.target.value}`, 'info');
      }
    });
  }

  // Devise du document
  const docCurrencySelect = document.getElementById('docCurrencySelect');
  if (docCurrencySelect) {
    docCurrencySelect.addEventListener('change', (e) => {
      if (activeDoc) {
        activeDoc.devise = e.target.value;
        Store.saveDoc(activeDoc);
        renderSidebar();
        renderActiveDocument();
        showToast(`Devise mise à jour : ${activeDoc.devise}`, 'info');
      }
    });
  }

  // Toggle Banque
  const toggleBankBtn = document.getElementById('toggleBankBtn');
  if (toggleBankBtn) {
    toggleBankBtn.addEventListener('click', () => {
      if (activeDoc) {
        activeDoc.showBanque = !activeDoc.showBanque;
        Store.saveDoc(activeDoc);
        renderActiveDocument();
      }
    });
  }

  // Toggle Acompte / Solde
  const toggleAcompteBtn = document.getElementById('toggleAcompteBtn');
  if (toggleAcompteBtn) {
    toggleAcompteBtn.addEventListener('click', () => {
      if (activeDoc) {
        activeDoc.showAcompteSolde = !activeDoc.showAcompteSolde;
        Store.saveDoc(activeDoc);
        renderActiveDocument();
      }
    });
  }

  // Toggle Signature
  const toggleSigBtn = document.getElementById('toggleSigBtn');
  if (toggleSigBtn) {
    toggleSigBtn.addEventListener('click', () => {
      if (activeDoc) {
        activeDoc.showSignature = !activeDoc.showSignature;
        Store.saveDoc(activeDoc);
        renderActiveDocument();
      }
    });
  }

  // Gestion de l'encart flottant rétractable des paramètres & options
  const docFloatingPanel = document.getElementById('docFloatingPanel');
  const btnToggleFloatingPanel = document.getElementById('btnToggleFloatingPanel');
  const btnCloseFloatingPanel = document.getElementById('btnCloseFloatingPanel');

  if (btnToggleFloatingPanel && docFloatingPanel) {
    btnToggleFloatingPanel.addEventListener('click', (e) => {
      e.stopPropagation();
      docFloatingPanel.classList.toggle('open');
    });
  }

  if (btnCloseFloatingPanel && docFloatingPanel) {
    btnCloseFloatingPanel.addEventListener('click', (e) => {
      e.stopPropagation();
      docFloatingPanel.classList.remove('open');
    });
  }

  // Sauvegarder comme modèle
  const btnSaveAsTemplate = document.getElementById('btnSaveAsTemplate');
  if (btnSaveAsTemplate) {
    btnSaveAsTemplate.addEventListener('click', () => {
      if (!activeDoc) return;
      const tName = prompt('Nom du modèle :', `Modèle ${activeDoc.titreDoc} - ${activeDoc.client?.nom || 'Générique'}`);
      if (tName) {
        Store.saveUserTemplate(activeDoc, tName);
        showToast('Modèle enregistré avec succès !', 'success');
      }
    });
  }

  // Dupliquer le document
  const btnDuplicateDoc = document.getElementById('btnDuplicateDoc');
  if (btnDuplicateDoc) {
    btnDuplicateDoc.addEventListener('click', () => {
      if (!activeDoc) return;
      const copy = Store.duplicateDoc(activeDoc.id);
      if (copy) {
        selectDocument(copy.id);
        showToast(`Document dupliqué sous le numéro ${copy.numero}`, 'success');
      }
    });
  }

  // Supprimer le document
  const btnDeleteDoc = document.getElementById('btnDeleteDoc');
  if (btnDeleteDoc) {
    btnDeleteDoc.addEventListener('click', () => {
      if (!activeDoc) return;
      if (confirm(`Êtes-vous sûr de vouloir supprimer le document ${activeDoc.numero} ?`)) {
        const idToDelete = activeDoc.id;
        Store.deleteDoc(idToDelete);
        const remaining = Store.getAllDocs();
        if (remaining.length > 0) {
          selectDocument(remaining[0].id);
        } else {
          openNewDocModal('devis');
        }
        showToast('Document supprimé', 'info');
      }
    });
  }

  // --- EXPORT PDF & IMPRESSION ---
  const btnExportPdf = document.getElementById('btnExportPdf');
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      if (!activeDoc) return;

      // Sauvegarder l'état actuel
      Store.saveDoc(activeDoc);
      renderActiveDocument();

      const filename = Nomenclature.generatePdfFilename(activeDoc);
      showToast('Génération du PDF vectoriel (texte sélectionnable)...', 'info');

      try {
        if (window.PdfExporter && window.jspdf) {
          PdfExporter.exportToPdf(activeDoc, filename);
          showToast(`PDF téléchargé : ${filename}`, 'success');
        } else if (window.html2pdf) {
          const element = document.getElementById('printableA4Document');
          if (!element) return;
          element.classList.add('exporting-pdf');
          element.querySelectorAll('textarea').forEach(autoResizeTextarea);

          const opt = {
            margin: 0,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              letterRendering: true,
              scrollY: 0,
              scrollX: 0
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'avoid-all' }
          };

          window.html2pdf()
            .set(opt)
            .from(element)
            .save()
            .then(() => {
              element.classList.remove('exporting-pdf');
              element.querySelectorAll('textarea').forEach(autoResizeTextarea);
              showToast(`PDF téléchargé : ${filename}`, 'success');
            })
            .catch((err) => {
              console.error('Erreur html2pdf:', err);
              element.classList.remove('exporting-pdf');
              element.querySelectorAll('textarea').forEach(autoResizeTextarea);
              window.print();
            });
        } else {
          window.print();
        }
      } catch (err) {
        console.error('Erreur export PDF:', err);
        showToast('Ouverture de l\'aperçu d\'impression...', 'warning');
        window.print();
      }
    });
  }

  const btnPrintA4 = document.getElementById('btnPrintA4');
  if (btnPrintA4) {
    btnPrintA4.addEventListener('click', () => {
      if (activeDoc) {
        Store.saveDoc(activeDoc);
        renderActiveDocument();
      }
      setTimeout(() => {
        window.print();
      }, 50);
    });
  }

  // --- MENU DE CRÉATION NOUVEAU DOCUMENT ---
  if (btnCreateMain && createMenu) {
    btnCreateMain.addEventListener('click', (e) => {
      e.stopPropagation();
      createMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      createMenu.classList.remove('show');
    });

    document.getElementById('menuCreateDevis')?.addEventListener('click', () => openNewDocModal('devis'));
    document.getElementById('menuOpenTemplates')?.addEventListener('click', openTemplatesModal);
  }

  // --- FILTRES & RECHERCHE ---
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderSidebar();
    });
  }

  filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      filterTabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      activeFilter = e.target.dataset.filter;
      renderSidebar();
    });
  });

  // Filtre Statut
  if (filterStatusSelect) {
    filterStatusSelect.addEventListener('change', (e) => {
      filterStatus = e.target.value;
      renderSidebar();
    });
  }

  // Filtre Projet
  if (filterProjectSelect) {
    filterProjectSelect.addEventListener('change', (e) => {
      filterProject = e.target.value;
      renderSidebar();
    });
  }

  // Filtre Période / Tri
  if (filterDateSelect) {
    filterDateSelect.addEventListener('change', (e) => {
      filterDate = e.target.value;
      renderSidebar();
    });
  }

  // Filtre Client
  if (filterClientSelect) {
    filterClientSelect.addEventListener('change', (e) => {
      filterClient = e.target.value;
      renderSidebar();
    });
  }

  // Toggle Affichage des Archives
  if (btnToggleArchived) {
    btnToggleArchived.addEventListener('click', () => {
      showArchived = !showArchived;
      localStorage.setItem('manticore_show_archived_v1', showArchived);
      renderSidebar();
      showToast(showArchived ? 'Affichage des documents archivés' : 'Masquage des documents archivés', 'info');
    });
  }

  // Réinitialisation des filtres
  if (btnResetFilters) {
    btnResetFilters.addEventListener('click', () => {
      filterStatus = 'all';
      filterProject = 'all';
      filterClient = 'all';
      filterDate = 'recent';
      searchQuery = '';
      activeFilter = 'all';

      if (filterStatusSelect) filterStatusSelect.value = 'all';
      if (filterProjectSelect) filterProjectSelect.value = 'all';
      if (filterDateSelect) filterDateSelect.value = 'recent';
      if (filterClientSelect) filterClientSelect.value = 'all';
      if (searchInput) searchInput.value = '';
      filterTabs.forEach(t => {
        if (t.dataset.filter === 'all') t.classList.add('active');
        else t.classList.remove('active');
      });

      renderSidebar();
      showToast('Filtres réinitialisés', 'info');
    });
  }

  // --- MODALE MODÈLES ---
  function openTemplatesModal() {
    const listEl = document.getElementById('templatesList');
    if (!listEl) return;

    const allTemplates = Store.getAllTemplatesCombined();
    listEl.innerHTML = '';

    allTemplates.forEach(tpl => {
      const card = document.createElement('div');
      card.className = 'template-card';
      const badge = tpl.isCustom ? '<span style="color: #ec4899; font-size: 10px; font-weight:700;">PERSO</span>' : '<span style="color: #38bdf8; font-size: 10px; font-weight:700;">OFFICIEL</span>';
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <span class="template-card-title">${escapeHtml(tpl.name)}</span>
          ${badge}
        </div>
        <p class="template-card-desc">${escapeHtml(tpl.description || '')}</p>
        <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: #64748b;">${tpl.items?.length || 0} lignes</span>
          <button class="btn btn-primary btn-sm btn-use-template">Utiliser ce modèle</button>
        </div>
      `;

      card.querySelector('.btn-use-template').addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal(modalTemplates);
        openNewDocModal(tpl.type || 'devis', tpl.id);
      });

      card.addEventListener('click', () => {
        closeModal(modalTemplates);
        openNewDocModal(tpl.type || 'devis', tpl.id);
      });

      listEl.appendChild(card);
    });

    openModal(modalTemplates);
  }

  // --- MODALE PROFIL ÉMETTEUR ---
  const btnOpenProfile = document.getElementById('btnOpenProfile');
  if (btnOpenProfile) {
    btnOpenProfile.addEventListener('click', () => {
      const profile = Store.getProfile();
      document.getElementById('profNom').value = profile.nom || '';
      document.getElementById('profLigne1').value = profile.ligne1 || '';
      document.getElementById('profLigne2').value = profile.ligne2 || '';
      document.getElementById('profEmail').value = profile.email || '';
      document.getElementById('profSiret').value = profile.siret || '';
      document.getElementById('profStatut').value = profile.statut || '';
      document.getElementById('profFooter').value = profile.mentionBasDePage || '';

      document.getElementById('profBankTitulaire').value = profile.banque?.titulaire || '';
      document.getElementById('profBankNom').value = profile.banque?.banque || '';
      document.getElementById('profBankIban').value = profile.banque?.iban || '';
      document.getElementById('profBankBic').value = profile.banque?.bic || '';

      openModal(modalProfile);
    });
  }

  document.getElementById('btnSaveProfile')?.addEventListener('click', () => {
    const updated = {
      nom: document.getElementById('profNom').value,
      ligne1: document.getElementById('profLigne1').value,
      ligne2: document.getElementById('profLigne2').value,
      email: document.getElementById('profEmail').value,
      siret: document.getElementById('profSiret').value,
      statut: document.getElementById('profStatut').value,
      mentionBasDePage: document.getElementById('profFooter').value,
      banque: {
        titulaire: document.getElementById('profBankTitulaire').value,
        banque: document.getElementById('profBankNom').value,
        iban: document.getElementById('profBankIban').value,
        bic: document.getElementById('profBankBic').value
      }
    };

    Store.saveProfile(updated);
    closeModal(modalProfile);
    showToast('Profil enregistré par défaut', 'success');
  });

  // --- MODALE CARNET DE CLIENTS ---
  const btnOpenClients = document.getElementById('btnOpenClients');
  if (btnOpenClients) {
    btnOpenClients.addEventListener('click', openClientsModal);
  }

  function openClientsModal() {
    const listEl = document.getElementById('clientsList');
    if (!listEl) return;

    const clients = Store.getClients();
    listEl.innerHTML = '';

    if (clients.length === 0) {
      listEl.innerHTML = '<p style="color:#64748b; font-size:12px;">Aucun client enregistré.</p>';
    } else {
      clients.forEach(c => {
        const item = document.createElement('div');
        item.style.cssText = 'background:#0f172a; padding:10px 14px; border:1px solid #334155; border-radius:6px; display:flex; justify-content:space-between; align-items:center;';
        item.innerHTML = `
          <div>
            <div style="font-weight:700; color:#fff; font-size:13px;">${escapeHtml(c.nom)}</div>
            <div style="color:#94a3b8; font-size:11px;">${escapeHtml(c.adresse1 || '')} ${escapeHtml(c.adresse2 || '')}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-primary btn-sm btn-select-client">Sélectionner</button>
            <button class="btn btn-danger-outline btn-sm btn-delete-client">✕</button>
          </div>
        `;

        item.querySelector('.btn-select-client').addEventListener('click', () => {
          if (activeDoc) {
            activeDoc.client.nom = c.nom;
            activeDoc.client.adresse1 = c.adresse1 || '';
            activeDoc.client.adresse2 = c.adresse2 || '';
            activeDoc.client.email = c.email || '';
            Store.saveDoc(activeDoc);
            renderActiveDocument();
            closeModal(modalClients);
            showToast(`Client "${c.nom}" appliqué`, 'success');
          }
        });

        item.querySelector('.btn-delete-client').addEventListener('click', () => {
          if (confirm(`Supprimer le client "${c.nom}" ?`)) {
            Store.deleteClient(c.id);
            openClientsModal();
          }
        });

        listEl.appendChild(item);
      });
    }

    openModal(modalClients);
  }

  document.getElementById('btnAddNewClient')?.addEventListener('click', () => {
    const nom = prompt('Nom du client / Société :');
    if (!nom) return;
    const adr1 = prompt('Adresse (ex: 10, rue de la Paix) :') || '';
    const adr2 = prompt('Code postal et ville (ex: 75001 Paris) :') || '';
    const email = prompt('Email :') || '';

    Store.saveClient({ nom, adresse1: adr1, adresse2: adr2, email });
    openClientsModal();
    showToast('Nouveau client ajouté', 'success');
  });

  // --- MODALE SAUVEGARDE & RESTAURATION JSON ---
  const btnOpenBackup = document.getElementById('btnOpenBackup');
  if (btnOpenBackup) {
    btnOpenBackup.addEventListener('click', () => {
      const jsonStr = Store.exportBackupJSON();
      document.getElementById('backupJsonText').value = jsonStr;
      openModal(modalBackup);
    });
  }

  document.getElementById('btnDownloadBackup')?.addEventListener('click', () => {
    const jsonStr = Store.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_devis_factures_${Nomenclature.formatDateToYYYYMMDD(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Fichier de sauvegarde téléchargé', 'success');
  });

  document.getElementById('btnImportBackup')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const res = Store.importBackupJSON(re.target.result);
        if (res.success) {
          closeModal(modalBackup);
          selectDocument(Store.getActiveDocId());
          showToast(`Restauration réussie (${res.count} documents)`, 'success');
        } else {
          alert('Erreur lors de la lecture du fichier de sauvegarde : ' + res.error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // Gestion ouverture / fermeture générique des modales
  function openModal(modal) {
    if (modal) modal.classList.add('show');
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove('show');
  }

  document.querySelectorAll('.modal-close-btn, .btn-modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const m = e.target.closest('.modal-backdrop');
      if (m) closeModal(m);
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });

  // ==========================================================================
  // ONBOARDING / GUIDE DE PRISE EN MAIN
  // ==========================================================================
  const modalOnboarding = document.getElementById('modalOnboarding');
  const btnOpenOnboarding = document.getElementById('btnOpenOnboarding');
  const btnSkipOnboarding = document.getElementById('btnSkipOnboarding');
  const btnPrevOnboarding = document.getElementById('btnPrevOnboarding');
  const btnNextOnboarding = document.getElementById('btnNextOnboarding');
  const btnCloseOnboardingX = document.getElementById('btnCloseOnboardingX');
  const onboardingSlides = document.querySelectorAll('.onboarding-slide');
  const onboardingDots = document.querySelectorAll('.onboarding-dot');

  let currentOnboardingStep = 1;
  const totalOnboardingSteps = 5;

  function showOnboardingStep(step) {
    currentOnboardingStep = Math.max(1, Math.min(step, totalOnboardingSteps));
    
    onboardingSlides.forEach(slide => {
      const s = parseInt(slide.getAttribute('data-step'), 10);
      slide.classList.toggle('active', s === currentOnboardingStep);
    });

    onboardingDots.forEach(dot => {
      const d = parseInt(dot.getAttribute('data-dot'), 10);
      dot.classList.toggle('active', d === currentOnboardingStep);
    });

    if (btnPrevOnboarding) {
      btnPrevOnboarding.style.display = currentOnboardingStep === 1 ? 'none' : 'inline-flex';
    }

    if (btnNextOnboarding) {
      btnNextOnboarding.textContent = currentOnboardingStep === totalOnboardingSteps ? "C'est parti ! 🚀" : "Suivant →";
    }
  }

  function finishOnboarding() {
    closeModal(modalOnboarding);
    localStorage.setItem('manticore_onboarding_seen', 'true');
  }

  if (btnNextOnboarding) {
    btnNextOnboarding.addEventListener('click', () => {
      if (currentOnboardingStep < totalOnboardingSteps) {
        showOnboardingStep(currentOnboardingStep + 1);
      } else {
        finishOnboarding();
        showToast('Bonne création de vos devis et factures !', 'success');
      }
    });
  }

  if (btnPrevOnboarding) {
    btnPrevOnboarding.addEventListener('click', () => {
      if (currentOnboardingStep > 1) {
        showOnboardingStep(currentOnboardingStep - 1);
      }
    });
  }

  if (btnSkipOnboarding) {
    btnSkipOnboarding.addEventListener('click', () => {
      finishOnboarding();
    });
  }

  if (btnCloseOnboardingX) {
    btnCloseOnboardingX.addEventListener('click', () => {
      finishOnboarding();
    });
  }

  onboardingDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const d = parseInt(dot.getAttribute('data-dot'), 10);
      if (d) showOnboardingStep(d);
    });
  });

  if (btnOpenOnboarding) {
    btnOpenOnboarding.addEventListener('click', () => {
      showOnboardingStep(1);
      openModal(modalOnboarding);
    });
  }

  // Affichage automatique au tout premier chargement
  if (!localStorage.getItem('manticore_onboarding_seen')) {
    setTimeout(() => {
      showOnboardingStep(1);
      openModal(modalOnboarding);
    }, 300);
  }

  // ==========================================================================
  // GESTIONNAIRE DE THÈME NEUMORPHIQUE (LIGHT & DARK MODE)
  // ==========================================================================
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeIcon = document.getElementById('themeIcon');

  function getActiveTheme() {
    let saved = localStorage.getItem('manticore_theme');
    if (!saved) {
      saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    return saved;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('manticore_theme', theme);
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    if (btnThemeToggle) {
      btnThemeToggle.title = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre (Dark Mode)';
      btnThemeToggle.setAttribute('aria-label', btnThemeToggle.title);
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || getActiveTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    showToast(next === 'dark' ? 'Mode Sombre activé 🌙' : 'Mode Clair activé ☀️', 'info');
  }

  function initThemeManager() {
    const theme = getActiveTheme();
    applyTheme(theme);

    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', toggleTheme);
    }
  }

  // Initialisation du thème
  initThemeManager();

  // Initialisation du premier document
  const activeId = Store.getActiveDocId();
  selectDocument(activeId);
});


