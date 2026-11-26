// =========================================================================
// LÓGICA DE ADMINISTRACIÓN Y ROLES (ADMIN & BARBEROS)
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const {
    escapeHtml,
    sanitizeUrl,
    getLocalDateStr,
    getLocalDateOffset,
    formatPrice,
    parseClosedDays
  } = window.AppUtils;

  // --- Estado de la sesión ---
  let currentUserSession = null;
  let userProfile = null;
  let barberProfile = null;

  // --- Elementos del DOM ---
  const viewLogin = document.getElementById("admin-login-view");
  const viewDashboard = document.getElementById("admin-dashboard-view");
  const formLogin = document.getElementById("admin-login-form");
  const btnLogout = document.getElementById("btn-logout");

  const userGreeting = document.getElementById("user-greeting");
  const userRoleTag = document.getElementById("user-role-tag");

  const panelSuperAdmin = document.getElementById("panel-superadmin");
  const panelBarber = document.getElementById("panel-barber");
  const adminTabContainer = document.getElementById("admin-tab-container");

  const listAppointments = document.getElementById("list-appointments");
  const statAppointmentsCount = document.getElementById("stat-appointments-count");
  const statEarnings = document.getElementById("stat-earnings");
  const dateFilterInput = document.getElementById("date-filter");

  const formBarberProfile = document.getElementById("form-barber-profile");
  const editBioInput = document.getElementById("edit-bio");
  const editPhotoFile = document.getElementById("edit-photo_file");
  const barberPreviewImg = document.getElementById("barber-preview-img");
  const barberPreviewText = document.getElementById("barber-preview-text");
  const editSpecialtiesInput = document.getElementById("edit-specialties");

  const formManageService = document.getElementById("form-manage-service");
  const listAdminServices = document.getElementById("list-admin-services");

  const formManageBarber = document.getElementById("form-manage-barber");
  const listAdminBarbers = document.getElementById("list-admin-barbers");
  const formManageHome = document.getElementById("form-manage-home");

  const STATUS_META = {
    pending: { text: "Por Confirmar", cls: "status-pending" },
    scheduled: { text: "Confirmado", cls: "status-scheduled" },
    completed: { text: "Completado", cls: "status-completed" },
    cancelled: { text: "Cancelado", cls: "status-cancelled" }
  };

  function getStatusMeta(status) {
    return STATUS_META[status] || STATUS_META.scheduled;
  }

  function renderAppointmentCard(app, options = {}) {
    const {
      showDate = false,
      highlightPending = false,
      showActions = true,
      showBarber = Boolean(userProfile && userProfile.is_admin)
    } = options;

    const item = document.createElement("div");
    item.className = `appointment-list-item ${escapeHtml(app.status)}`;
    if (highlightPending && app.status === "pending") {
      item.style.borderColor = "var(--warning)";
    }

    const price = app.services ? parseFloat(app.services.price) : 0;
    const formattedTime = (app.appointment_time || "00:00").slice(0, 5);
    const serviceName = app.services ? app.services.name : "Servicio Desconocido";
    const barberName = app.barbers ? app.barbers.name : "Sin Asignar";

    const rawDate = new Date(app.appointment_date + "T00:00:00");
    const formattedDate = rawDate.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
    const timeText = showDate ? `${formattedDate} - ${formattedTime} hs` : `${formattedTime} hs`;

    const { text: statusText, cls: statusClass } = getStatusMeta(app.status);
    const timeTagStyle = highlightPending ? "style=\"color: var(--warning);\"" : "";

    let actionsHtml = "";
    if (showActions && app.status === "pending") {
      actionsHtml = `
        <div class="appointment-actions">
          <button class="btn btn-primary btn-small btn-accept" data-id="${escapeHtml(app.id)}">Aceptar</button>
          <button class="btn btn-danger btn-small btn-cancel" data-id="${escapeHtml(app.id)}">Cancelar</button>
        </div>
      `;
    } else if (showActions && app.status === "scheduled") {
      actionsHtml = `
        <div class="appointment-actions">
          <button class="btn btn-primary btn-small btn-complete" data-id="${escapeHtml(app.id)}">Completar</button>
          <button class="btn btn-danger btn-small btn-cancel" data-id="${escapeHtml(app.id)}">Cancelar</button>
        </div>
      `;
    }

    item.innerHTML = `
      <div class="appointment-header">
        <span class="appointment-time-tag" ${timeTagStyle}>${escapeHtml(timeText)}</span>
        <span class="appointment-status-tag ${statusClass}">${statusText}</span>
      </div>
      <div class="appointment-details">
        <p><strong>Cliente:</strong> ${escapeHtml(app.client_name)} (${escapeHtml(app.client_phone)})</p>
        ${app.client_email ? `<p><strong>Email:</strong> ${escapeHtml(app.client_email)}</p>` : ""}
        <p><strong>Servicio:</strong> ${escapeHtml(serviceName)} ($${formatPrice(price)})</p>
        ${showBarber ? `<p><strong>Barbero:</strong> ${escapeHtml(barberName)}</p>` : ""}
      </div>
      ${actionsHtml}
    `;

    if (showActions) {
      const btnAccept = item.querySelector(".btn-accept");
      if (btnAccept) btnAccept.addEventListener("click", () => updateAppointmentStatus(app.id, "scheduled"));

      const btnComplete = item.querySelector(".btn-complete");
      if (btnComplete) btnComplete.addEventListener("click", () => updateAppointmentStatus(app.id, "completed"));

      const btnCancel = item.querySelector(".btn-cancel");
      if (btnCancel) btnCancel.addEventListener("click", () => updateAppointmentStatus(app.id, "cancelled"));
    }

    return item;
  }

  // --- Helper reutilizable para barras de pestañas con scroll horizontal ---
  function setupScrollableTabBar(wrapperId, barId, prevBtnId, nextBtnId) {
    const wrapper = document.getElementById(wrapperId);
    const bar = document.getElementById(barId);
    const prevBtn = document.getElementById(prevBtnId);
    const nextBtn = document.getElementById(nextBtnId);

    function updateHints() {
      if (!wrapper || !bar) return;
      const maxScroll = bar.scrollWidth - bar.clientWidth;
      wrapper.classList.toggle("has-left", bar.scrollLeft > 4);
      wrapper.classList.toggle("has-right", maxScroll > 4 && bar.scrollLeft < maxScroll - 4);
    }

    if (bar) {
      bar.addEventListener("scroll", updateHints, { passive: true });
      window.addEventListener("resize", updateHints);
    }
    if (prevBtn && bar) {
      prevBtn.addEventListener("click", () => bar.scrollBy({ left: -140, behavior: "smooth" }));
    }
    if (nextBtn && bar) {
      nextBtn.addEventListener("click", () => bar.scrollBy({ left: 140, behavior: "smooth" }));
    }

    return updateHints;
  }

  // --- Sub-pestañas de Admin (Solo Super Admin) ---
  const tabBtns = document.querySelectorAll(".admin-tab-btn");
  const subPanes = document.querySelectorAll(".admin-subpane");
  const adminTabsWrapper = document.getElementById("admin-tabs-wrapper");
  const adminSubtabsWrapper = document.getElementById("admin-subtabs-wrapper");
  const btnAdminMenu = document.getElementById("btn-admin-menu");
  const adminMenuOverlay = document.getElementById("admin-menu-overlay");
  const adminMenuList = document.getElementById("admin-menu-list");
  const adminMenuUser = document.getElementById("admin-menu-user");
  const btnAdminMenuClose = document.getElementById("btn-admin-menu-close");
  const btnMenuLogout = document.getElementById("btn-menu-logout");

  function closeAdminMenu() {
    if (!adminMenuOverlay || !btnAdminMenu) return;
    adminMenuOverlay.classList.remove("open");
    adminMenuOverlay.setAttribute("aria-hidden", "true");
    btnAdminMenu.setAttribute("aria-expanded", "false");
    btnAdminMenu.classList.remove("active");
  }

  function renderAdminMenu() {
    if (!adminMenuList) return;
    const isAdmin = Boolean(userProfile && userProfile.is_admin);
    if (adminMenuUser) {
      adminMenuUser.textContent = userGreeting ? userGreeting.textContent : "Menú";
    }

    const groups = isAdmin
      ? [
          {
            title: "Citas",
            items: [
              { label: "Citas del Día", icon: "calendar", tab: "tab-appointments" },
              { label: "Solicitudes por Confirmar", icon: "clock", tab: "tab-appointments", subBtnId: "btn-subtab-pending", isSub: true },
              { label: "Agenda / Citas Agendadas", icon: "calendar-check", tab: "tab-appointments", subBtnId: "btn-subtab-agenda", isSub: true }
            ]
          },
          {
            title: "Gestión",
            items: [
              { label: "Servicios", icon: "scissors", tab: "tab-services" },
              { label: "Barberos", icon: "users", tab: "tab-barbers" },
              { label: "Galería", icon: "image", tab: "tab-gallery" },
              { label: "Inicio y Horarios", icon: "home", tab: "tab-homeconfig" },
              { label: "Reportes", icon: "bar-chart-2", tab: "tab-reports" }
            ]
          }
        ]
      : barberProfile
        ? [
            {
              title: "Mi Panel",
              items: [
                { label: "Mi Perfil", icon: "user", subBtnId: "btn-subtab-profile" },
                { label: "Solicitudes por Confirmar", icon: "clock", subBtnId: "btn-subtab-pending" },
                { label: "Agenda / Citas Agendadas", icon: "calendar-check", subBtnId: "btn-subtab-agenda" }
              ]
            }
          ]
        : [];

    adminMenuList.innerHTML = "";
    let itemIdx = 0;

    groups.forEach((group) => {
      const groupTitle = document.createElement("div");
      groupTitle.className = "admin-menu-group-label";
      groupTitle.textContent = group.title;
      adminMenuList.appendChild(groupTitle);

      group.items.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `admin-menu-item${item.isSub ? " is-sub" : ""}`;
        btn.style.setProperty("--item-idx", String(itemIdx++));

        let isActive = false;
        if (item.tab && item.subBtnId) {
          const tabBtn = document.querySelector(`.admin-tab-btn[data-tab="${item.tab}"]`);
          const subBtn = document.getElementById(item.subBtnId);
          isActive = Boolean(tabBtn && tabBtn.classList.contains("active") && subBtn && subBtn.classList.contains("active"));
        } else if (item.tab) {
          const tabBtn = document.querySelector(`.admin-tab-btn[data-tab="${item.tab}"]`);
          isActive = Boolean(tabBtn && tabBtn.classList.contains("active"));
        } else if (item.subBtnId) {
          const subBtn = document.getElementById(item.subBtnId);
          isActive = Boolean(subBtn && subBtn.classList.contains("active"));
        }
        if (isActive) btn.classList.add("active");

        btn.innerHTML = `
          <span class="admin-menu-item-left">
            <span class="admin-menu-icon-wrap"><i data-lucide="${item.icon}" style="width:17px; height:17px;"></i></span>
            <span>${item.label}</span>
          </span>
          <i data-lucide="chevron-right" style="width:16px; height:16px; opacity:0.5;"></i>
        `;

        btn.addEventListener("click", () => {
          if (item.tab) {
            const tabBtn = document.querySelector(`.admin-tab-btn[data-tab="${item.tab}"]`);
            if (tabBtn && !tabBtn.classList.contains("active")) {
              tabBtn.click();
            }
          }
          if (item.subBtnId) {
            const subBtn = document.getElementById(item.subBtnId);
            if (subBtn) subBtn.click();
          }
          closeAdminMenu();
        });

        adminMenuList.appendChild(btn);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function openAdminMenu() {
    if (!adminMenuOverlay || !btnAdminMenu) return;
    renderAdminMenu();
    adminMenuOverlay.classList.add("open");
    adminMenuOverlay.setAttribute("aria-hidden", "false");
    btnAdminMenu.setAttribute("aria-expanded", "true");
    btnAdminMenu.classList.add("active");
  }

  if (btnAdminMenu && adminMenuOverlay) {
    btnAdminMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      if (adminMenuOverlay.classList.contains("open")) {
        closeAdminMenu();
      } else {
        openAdminMenu();
      }
    });

    if (btnAdminMenuClose) {
      btnAdminMenuClose.addEventListener("click", closeAdminMenu);
    }

    if (btnMenuLogout) {
      btnMenuLogout.addEventListener("click", () => {
        closeAdminMenu();
        handleLogout();
      });
    }

    adminMenuOverlay.addEventListener("click", (e) => {
      if (e.target === adminMenuOverlay) closeAdminMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAdminMenu();
    });
  }
  const updateAdminTabsScrollHints = setupScrollableTabBar(
    "admin-tabs-wrapper",
    "admin-tab-container",
    "btn-tabs-prev",
    "btn-tabs-next"
  );
  const updateAppointmentSubtabsHints = setupScrollableTabBar(
    "admin-subtabs-wrapper",
    "admin-subtab-container",
    "btn-subtabs-prev",
    "btn-subtabs-next"
  );

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!userProfile || !userProfile.is_admin) return;
      tabBtns.forEach((b) => b.classList.remove("active"));
      subPanes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      const targetId = btn.dataset.tab;
      document.getElementById(targetId).classList.add("active");

      const appContent = document.querySelector(".app-content");
      if (appContent) appContent.scrollTo({ top: 0, behavior: "smooth" });

      if (adminSubtabsWrapper) {
        adminSubtabsWrapper.style.display = targetId === "tab-appointments" ? "block" : "none";
      }
      if (adminMenuOverlay && adminMenuOverlay.classList.contains("open")) {
        renderAdminMenu();
      }

      if (targetId === "tab-appointments") {
        loadAppointments();
        requestAnimationFrame(updateAppointmentSubtabsHints);
      } else if (targetId === "tab-services") {
        loadAdminServices();
      } else if (targetId === "tab-barbers") {
        loadAdminBarbers();
      } else if (targetId === "tab-gallery") {
        loadAdminGallery();
      } else if (targetId === "tab-homeconfig") {
        loadAdminHomeConfig();
      } else if (targetId === "tab-reports") {
        initReportsTab();
      }
    });
  });

  // --- Sub-pestañas Internas de Citas (Mi Perfil vs Por Confirmar vs Agenda) ---
  const btnSubtabProfile = document.getElementById("btn-subtab-profile");
  const btnSubtabPending = document.getElementById("btn-subtab-pending");
  const btnSubtabAgenda = document.getElementById("btn-subtab-agenda");

  const paneProfile = document.getElementById("panel-barber");
  const panePending = document.getElementById("subtab-pane-pending");
  const paneAgenda = document.getElementById("subtab-pane-agenda");

  if (btnSubtabProfile && btnSubtabPending && btnSubtabAgenda && paneProfile && panePending && paneAgenda) {
    const activateSubtab = (activeBtn, activePane) => {
      [btnSubtabProfile, btnSubtabPending, btnSubtabAgenda].forEach((b) => b.classList.remove("active"));
      [paneProfile, panePending, paneAgenda].forEach((p) => { p.style.display = "none"; });
      activeBtn.classList.add("active");
      activePane.style.display = "block";
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      const appContent = document.querySelector(".app-content");
      if (appContent) appContent.scrollTo({ top: 0, behavior: "smooth" });
      if (adminMenuOverlay && adminMenuOverlay.classList.contains("open")) {
        renderAdminMenu();
      }
    };

    btnSubtabProfile.addEventListener("click", (e) => {
      e.preventDefault();
      activateSubtab(btnSubtabProfile, paneProfile);
    });

    btnSubtabPending.addEventListener("click", (e) => {
      e.preventDefault();
      activateSubtab(btnSubtabPending, panePending);
    });

    btnSubtabAgenda.addEventListener("click", (e) => {
      e.preventDefault();
      activateSubtab(btnSubtabAgenda, paneAgenda);
    });
  }

  // --- 1. Verificación Inicial de Autenticación ---
  checkAuth();

  async function checkAuth() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      const navAdmin = document.getElementById("nav-admin");
      if (session) {
        currentUserSession = session;
        if (navAdmin) navAdmin.style.display = "flex";
        await loadUserDataAndRedirect();
      } else {
        if (navAdmin) navAdmin.style.display = "none";
        showLoginView();
        if (typeof window.hidePageLoader === "function") window.hidePageLoader();
      }
    } catch (err) {
      console.error("Error comprobando sesión:", err.message);
      const navAdmin = document.getElementById("nav-admin");
      if (navAdmin) navAdmin.style.display = "none";
      showLoginView();
      if (typeof window.hidePageLoader === "function") window.hidePageLoader();
    }
  }

  function showLoginView() {
    viewLogin.style.display = "block";
    viewDashboard.style.display = "none";
  }

  function showDashboardView() {
    viewLogin.style.display = "none";
    viewDashboard.style.display = "block";
  }

  // --- 2. Carga Perfil de Usuario y Detecta Rol ---
  async function loadUserDataAndRedirect() {
    const userId = currentUserSession.user.id;

    try {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileErr) throw profileErr;
      userProfile = profile;

      const { data: barber } = await supabase
        .from("barbers")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      barberProfile = barber;

      showDashboardView();

      // Inicializar filtro de fecha con la fecha LOCAL de hoy
      if (!dateFilterInput.value) {
        dateFilterInput.value = getLocalDateStr();
      }

      const adminOnlyTabIds = ["tab-services", "tab-barbers", "tab-gallery", "tab-homeconfig", "tab-reports"];

      if (userProfile.is_admin) {
        userGreeting.textContent = `Hola, ${currentUserSession.user.email.split("@")[0]}`;
        userRoleTag.textContent = "Super Administrador";
        userRoleTag.className = "appointment-status-tag status-scheduled";

        panelSuperAdmin.style.display = "block";
        if (adminTabsWrapper) adminTabsWrapper.style.display = "block";
        if (adminSubtabsWrapper) adminSubtabsWrapper.style.display = "block";
        adminTabContainer.style.display = "flex";
        requestAnimationFrame(() => {
          updateAdminTabsScrollHints();
          updateAppointmentSubtabsHints();
        });
        adminOnlyTabIds.forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "";
        });

        if (btnSubtabProfile) btnSubtabProfile.style.display = "none";
        if (btnSubtabPending && btnSubtabAgenda && paneProfile && panePending && paneAgenda) {
          btnSubtabPending.classList.add("active");
          btnSubtabAgenda.classList.remove("active");
          btnSubtabProfile.classList.remove("active");
          panePending.style.display = "block";
          paneAgenda.style.display = "none";
          paneProfile.style.display = "none";
        }

        await loadAppointments();
        if (btnAdminMenu) btnAdminMenu.style.display = "inline-flex";
      } else if (barberProfile) {
        userGreeting.textContent = `Hola, ${barberProfile.name}`;
        userRoleTag.textContent = "Barbero Staff";
        userRoleTag.className = "appointment-status-tag status-completed";

        panelSuperAdmin.style.display = "none";
        if (adminTabsWrapper) adminTabsWrapper.style.display = "none";
        if (adminSubtabsWrapper) adminSubtabsWrapper.style.display = "block";
        adminTabContainer.style.display = "none";

        // Bloqueo estricto de todos los subpaneles exclusivos de Super Admin
        adminOnlyTabIds.forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.style.display = "none";
            el.classList.remove("active");
          }
        });

        editBioInput.value = barberProfile.bio || "";
        editSpecialtiesInput.value = barberProfile.specialties ? barberProfile.specialties.join(", ") : "";
        const safePhoto = sanitizeUrl(barberProfile.photo_url, "", { allowDataImage: true });
        if (safePhoto) {
          barberPreviewImg.src = safePhoto;
          barberPreviewImg.style.display = "block";
          barberPreviewText.style.display = "none";
        }

        if (btnSubtabProfile && btnSubtabPending && btnSubtabAgenda && paneProfile && panePending && paneAgenda) {
          btnSubtabProfile.style.display = "block";
          btnSubtabProfile.classList.add("active");
          btnSubtabPending.classList.remove("active");
          btnSubtabAgenda.classList.remove("active");
          paneProfile.style.display = "block";
          panePending.style.display = "none";
          paneAgenda.style.display = "none";
        }

        await loadAppointments();
        if (btnAdminMenu) btnAdminMenu.style.display = "inline-flex";
        requestAnimationFrame(updateAppointmentSubtabsHints);
      } else {
        if (btnAdminMenu) btnAdminMenu.style.display = "none";
        closeAdminMenu();
        userGreeting.textContent = "Usuario no autorizado";
        userRoleTag.textContent = "Sin Rol Asignado";
        userRoleTag.className = "appointment-status-tag status-cancelled";
        listAppointments.innerHTML = "<p class='text-danger'>Tu cuenta no está vinculada a ningún barbero o administración. Contacta al soporte.</p>";
        panelSuperAdmin.style.display = "none";
        panelBarber.style.display = "none";
      }
    } catch (err) {
      console.error("Error cargando perfil del usuario:", err.message);
      await showAlert("Error al cargar perfil de usuario: " + err.message, "Error de Perfil", "alert-triangle");
      handleLogout();
    } finally {
      if (typeof window.hidePageLoader === "function") window.hidePageLoader();
    }
  }

  // --- 3. Inicio de Sesión ---
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("admin-email").value.trim();
      const password = document.getElementById("admin-password").value.trim();
      const btnSubmit = formLogin.querySelector("button[type='submit']");

      btnSubmit.setAttribute("disabled", "true");
      btnSubmit.textContent = "Iniciando sesión...";

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        currentUserSession = data.session;
        const navAdmin = document.getElementById("nav-admin");
        if (navAdmin) navAdmin.style.display = "flex";
        await loadUserDataAndRedirect();
      } catch (err) {
        console.error("Error Login:", err.message);
        await showAlert("Credenciales inválidas o error de red: " + err.message, "Error de Autenticación", "alert-triangle");
      } finally {
        btnSubmit.removeAttribute("disabled");
        btnSubmit.textContent = "Ingresar";
      }
    });
  }

  // --- 4. Carga y Gestión de Citas ---
  async function loadAppointments() {
    loadPendingAppointments();

    listAppointments.innerHTML = "<p class='text-muted'>Cargando citas...</p>";
    const selectedDate = dateFilterInput.value;

    const agendaTitle = document.getElementById("agenda-section-title");
    if (agendaTitle) {
      agendaTitle.textContent = selectedDate ? "Agenda del Día" : "Todas las Citas Agendadas";
    }

    try {
      let query = supabase
        .from("appointments")
        .select(`
          *,
          barbers ( name ),
          services ( name, price )
        `)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (selectedDate) {
        query = query.eq("appointment_date", selectedDate);
      } else {
        query = query.eq("status", "scheduled");
      }

      if (!userProfile.is_admin && barberProfile) {
        query = query.eq("barber_id", barberProfile.id);
      }

      const { data: appointments, error } = await query;
      if (error) throw error;

      listAppointments.innerHTML = "";
      const totalCitas = appointments.length;
      let totalGanancias = 0;

      statAppointmentsCount.textContent = totalCitas;

      if (totalCitas === 0) {
        listAppointments.innerHTML = "<p class='text-muted' style='text-align:center; padding: 20px 0;'>No hay citas agendadas para este día.</p>";
        statEarnings.textContent = "$0";
        return;
      }

      appointments.forEach((app) => {
        const price = app.services ? parseFloat(app.services.price) : 0;
        if (app.status === "completed") {
          totalGanancias += price;
        }
        const card = renderAppointmentCard(app, {
          showDate: !selectedDate,
          highlightPending: false,
          showActions: true
        });
        listAppointments.appendChild(card);
      });

      statEarnings.textContent = `$${formatPrice(totalGanancias)}`;
    } catch (err) {
      console.error("Error al cargar citas:", err.message);
      listAppointments.innerHTML = "<p class='text-danger'>Error al cargar las citas de la base de datos.</p>";
    }
  }

  async function loadPendingAppointments() {
    const listPending = document.getElementById("list-pending-appointments");
    if (!listPending) return;

    try {
      let query = supabase
        .from("appointments")
        .select(`
          *,
          barbers ( name ),
          services ( name, price )
        `)
        .eq("status", "pending")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (!userProfile.is_admin && barberProfile) {
        query = query.eq("barber_id", barberProfile.id);
      }

      const { data: pendingApps, error } = await query;
      if (error) throw error;

      if (!pendingApps || pendingApps.length === 0) {
        listPending.innerHTML = `<p class="text-muted" style="text-align: center; padding: 40px 0;">No tienes solicitudes de citas pendientes por confirmar.</p>`;
        return;
      }

      listPending.innerHTML = "";
      pendingApps.forEach((app) => {
        const card = renderAppointmentCard(app, {
          showDate: true,
          highlightPending: true,
          showActions: true
        });
        listPending.appendChild(card);
      });

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error("Error al cargar citas pendientes:", err.message);
    }
  }

  if (dateFilterInput) {
    dateFilterInput.addEventListener("change", loadAppointments);
  }

  const btnClearDateFilter = document.getElementById("btn-clear-date-filter");
  if (btnClearDateFilter) {
    btnClearDateFilter.addEventListener("click", (e) => {
      e.preventDefault();
      if (dateFilterInput) {
        dateFilterInput.value = "";
        loadAppointments();
      }
    });
  }

  async function updateAppointmentStatus(appointmentId, newStatus) {
    let confirmMsg = "¿Estás seguro de actualizar el estado de esta cita?";
    if (newStatus === "scheduled") {
      confirmMsg = "¿Estás seguro de confirmar y aceptar esta cita?";
    } else if (newStatus === "completed") {
      confirmMsg = "¿Estás seguro de marcar esta cita como completada?";
    } else if (newStatus === "cancelled") {
      confirmMsg = "¿Estás seguro de cancelar esta cita?";
    }

    if (!await showConfirm(confirmMsg, "Actualizar Estado", newStatus === "cancelled" ? "alert-triangle" : "help-circle")) return;

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointmentId);

      if (error) throw error;
      loadAppointments();
    } catch (err) {
      console.error("Error actualizando cita:", err.message);
      await showAlert("No se pudo actualizar el estado de la cita: " + err.message, "Error", "alert-triangle");
    }
  }

  // --- 5. Edición de Perfil de Barbero ---
  if (formBarberProfile) {
    formBarberProfile.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btnSubmit = formBarberProfile.querySelector("button[type='submit']");
      btnSubmit.setAttribute("disabled", "true");
      btnSubmit.textContent = "Guardando...";

      const bio = editBioInput.value.trim();
      const specialties = editSpecialtiesInput.value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      try {
        let finalPhotoUrl = barberProfile.photo_url;

        if (editPhotoFile && editPhotoFile.files.length > 0) {
          btnSubmit.textContent = "Subiendo foto...";
          const file = editPhotoFile.files[0];
          const fileExt = file.name.split(".").pop();
          const fileName = `barber_${currentUserSession.user.id}_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("logos")
            .upload(fileName, file, { cacheControl: "3600", upsert: true });

          if (uploadError) throw new Error("Error al subir foto: " + uploadError.message);

          const { data: { publicUrl } } = supabase.storage
            .from("logos")
            .getPublicUrl(fileName);

          finalPhotoUrl = publicUrl;
          barberPreviewImg.src = finalPhotoUrl;
          barberPreviewImg.style.display = "block";
          barberPreviewText.style.display = "none";
        }

        const { error } = await supabase
          .from("barbers")
          .update({
            bio,
            photo_url: finalPhotoUrl,
            specialties
          })
          .eq("user_id", currentUserSession.user.id);

        if (error) throw error;
        await showAlert("¡Perfil actualizado con éxito!", "Perfil Actualizado", "check-circle");

        if (editPhotoFile) editPhotoFile.value = "";
        await loadUserDataAndRedirect();
      } catch (err) {
        console.error("Error actualizando perfil barbero:", err.message);
        await showAlert("Ocurrió un error al guardar: " + err.message, "Error al Guardar", "alert-triangle");
      } finally {
        btnSubmit.removeAttribute("disabled");
        btnSubmit.textContent = "Guardar Cambios";
      }
    });
  }

  // --- 6. Administración de Servicios (Solo Super Admin) ---
  async function loadAdminServices() {
    listAdminServices.innerHTML = "<p class='text-muted'>Cargando servicios...</p>";

    try {
      const { data: services, error } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      listAdminServices.innerHTML = "";
      if (services.length === 0) {
        listAdminServices.innerHTML = "<p class='text-muted'>No hay servicios registrados.</p>";
        return;
      }

      services.forEach((service) => {
        const item = document.createElement("div");
        item.className = "service-item";
        item.style.cursor = "default";

        item.innerHTML = `
          <div class="service-info">
            <span class="service-name">${escapeHtml(service.name)} ${!service.active ? '<span class="text-danger">(Inactivo)</span>' : ""}</span>
            <span class="service-meta">${Number(service.duration_minutes) || 30} min • ${escapeHtml(service.description || "Sin descripción")}</span>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <span class="service-price">$${formatPrice(service.price)}</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-primary btn-small edit-service-btn" style="padding:4px 8px; font-size:0.75rem;" data-id="${escapeHtml(service.id)}">Editar</button>
              <button class="btn btn-danger btn-small toggle-service-btn" style="padding:4px 8px; font-size:0.75rem;" data-id="${escapeHtml(service.id)}" data-active="${Boolean(service.active)}">
                ${service.active ? "Desactivar" : "Activar"}
              </button>
              <button class="btn btn-small delete-service-btn" style="padding:4px 8px; font-size:0.75rem; background:transparent; border:1px solid #ff4d4d; color:#ff4d4d;" data-id="${escapeHtml(service.id)}">
                Eliminar
              </button>
            </div>
          </div>
        `;

        item.querySelector(".toggle-service-btn").addEventListener("click", () => toggleServiceActive(service.id, service.active));
        item.querySelector(".edit-service-btn").addEventListener("click", () => editService(service));
        item.querySelector(".delete-service-btn").addEventListener("click", () => deleteService(service.id));

        listAdminServices.appendChild(item);
      });
    } catch (err) {
      console.error("Error cargando administración de servicios:", err.message);
      listAdminServices.innerHTML = "<p class='text-danger'>Error al conectar con la base de datos.</p>";
    }
  }

  async function toggleServiceActive(serviceId, currentActive) {
    try {
      const { error } = await supabase
        .from("services")
        .update({ active: !currentActive })
        .eq("id", serviceId);

      if (error) throw error;
      loadAdminServices();
    } catch (err) {
      console.error("Error cambiando estado de servicio:", err.message);
      await showAlert("Error al modificar servicio: " + err.message, "Error de Servicio", "alert-triangle");
    }
  }

  function editService(service) {
    document.getElementById("service-id").value = service.id;
    document.getElementById("service-name").value = service.name;
    document.getElementById("service-price").value = service.price;
    document.getElementById("service-duration").value = service.duration_minutes;
    document.getElementById("service-desc").value = service.description || "";

    document.getElementById("btn-submit-service").textContent = "Actualizar Servicio";
    document.getElementById("btn-cancel-service").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteService(serviceId) {
    if (!await showConfirm("¿Estás seguro de eliminar permanentemente este servicio? (Las citas existentes mantendrán el registro, pero el servicio no volverá a aparecer)", "Eliminar Servicio", "trash-2")) return;
    try {
      const { error } = await supabase.from("services").delete().eq("id", serviceId);
      if (error) throw error;
      loadAdminServices();
    } catch (err) {
      await showAlert("Error al eliminar servicio: " + err.message, "Error de Servicio", "alert-triangle");
    }
  }

  const btnCancelService = document.getElementById("btn-cancel-service");
  if (btnCancelService) {
    btnCancelService.addEventListener("click", () => {
      document.getElementById("service-id").value = "";
      formManageService.reset();
      document.getElementById("btn-submit-service").textContent = "Crear Servicio";
      btnCancelService.style.display = "none";
    });
  }

  if (formManageService) {
    formManageService.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btnSubmit = formManageService.querySelector("button[type='submit']");
      btnSubmit.setAttribute("disabled", "true");
      btnSubmit.textContent = "Guardando...";

      const serviceId = document.getElementById("service-id").value;
      const name = document.getElementById("service-name").value.trim();
      const price = parseFloat(document.getElementById("service-price").value);
      const duration_minutes = parseInt(document.getElementById("service-duration").value, 10);
      const description = document.getElementById("service-desc").value.trim();

      try {
        if (serviceId) {
          const { error } = await supabase
            .from("services")
            .update({ name, price, duration_minutes, description })
            .eq("id", serviceId);
          if (error) throw error;
          await showAlert("Servicio actualizado exitosamente.", "Servicio Actualizado", "check-circle");
        } else {
          const { error } = await supabase
            .from("services")
            .insert([{ name, price, duration_minutes, description, active: true }]);
          if (error) throw error;
          await showAlert("Servicio creado exitosamente.", "Servicio Creado", "check-circle");
        }

        formManageService.reset();
        document.getElementById("service-id").value = "";
        document.getElementById("btn-submit-service").textContent = "Crear Servicio";
        if (btnCancelService) btnCancelService.style.display = "none";
        loadAdminServices();
      } catch (err) {
        console.error("Error creando/actualizando servicio:", err.message);
        await showAlert("Error al guardar el servicio: " + err.message, "Error al Guardar", "alert-triangle");
      } finally {
        btnSubmit.removeAttribute("disabled");
        btnSubmit.textContent = document.getElementById("service-id").value ? "Actualizar Servicio" : "Crear Servicio";
      }
    });
  }

  // --- 8. Administración de Barberos (Solo Super Admin) ---
  async function loadAdminBarbers() {
    listAdminBarbers.innerHTML = "<p class='text-muted'>Cargando barberos...</p>";
    try {
      const { data: barbers, error } = await supabase.from("barbers").select("*").order("created_at", { ascending: false });
      if (error) throw error;

      listAdminBarbers.innerHTML = "";
      if (barbers.length === 0) {
        listAdminBarbers.innerHTML = "<p class='text-muted'>No hay barberos registrados.</p>";
        return;
      }

      barbers.forEach((barber) => {
        const item = document.createElement("div");
        item.className = "service-item";
        item.style.cursor = "default";
        const specText = Array.isArray(barber.specialties) && barber.specialties.length > 0
          ? barber.specialties.join(", ")
          : "Sin especialidades";
        const emailText = barber.login_email || "Sin correo vinculado";

        item.innerHTML = `
          <div class="service-info">
            <span class="service-name">${escapeHtml(barber.name)} ${!barber.active ? '<span class="text-danger">(Inactivo)</span>' : ""}</span>
            <span class="service-meta" style="color:var(--primary); font-size:0.85rem; margin-bottom:4px;">${escapeHtml(emailText)}</span>
            <span class="service-meta">${escapeHtml(specText)}</span>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <div style="display:flex; flex-wrap:wrap; justify-content:flex-end; gap:6px;">
              <button class="btn btn-primary btn-small edit-barber-btn" style="padding:4px 8px; font-size:0.75rem;" data-id="${escapeHtml(barber.id)}">Editar</button>
              <button class="btn btn-danger btn-small toggle-barber-btn" style="padding:4px 8px; font-size:0.75rem;" data-id="${escapeHtml(barber.id)}" data-active="${Boolean(barber.active)}">
                ${barber.active ? "Desactivar" : "Activar"}
              </button>
              <button class="btn btn-small delete-barber-btn" style="padding:4px 8px; font-size:0.75rem; background:transparent; border:1px solid #ff4d4d; color:#ff4d4d;" data-id="${escapeHtml(barber.id)}">
                Eliminar
              </button>
            </div>
          </div>
        `;

        item.querySelector(".toggle-barber-btn").addEventListener("click", () => toggleBarberActive(barber.id, barber.active));
        item.querySelector(".edit-barber-btn").addEventListener("click", () => editBarber(barber));
        item.querySelector(".delete-barber-btn").addEventListener("click", () => deleteBarber(barber.id));

        listAdminBarbers.appendChild(item);
      });
    } catch (err) {
      console.error("Error cargando barberos:", err.message);
      listAdminBarbers.innerHTML = "<p class='text-danger'>Error al conectar con la base de datos.</p>";
    }
  }

  async function toggleBarberActive(barberId, currentActive) {
    try {
      const { error } = await supabase.from("barbers").update({ active: !currentActive }).eq("id", barberId);
      if (error) throw error;
      loadAdminBarbers();
    } catch (err) {
      await showAlert("Error al modificar barbero: " + err.message, "Error de Barbero", "alert-triangle");
    }
  }

  async function deleteBarber(barberId) {
    if (!await showConfirm("¿Estás seguro de que deseas eliminar permanentemente a este barbero? (Sus citas pasadas quedarán en el historial como 'Sin Asignar').", "Eliminar Barbero", "trash-2")) return;
    try {
      const { error } = await supabase.from("barbers").delete().eq("id", barberId);
      if (error) throw error;
      loadAdminBarbers();
    } catch (err) {
      await showAlert("Error al eliminar barbero: " + err.message, "Error de Barbero", "alert-triangle");
    }
  }

  function editBarber(barber) {
    document.getElementById("barber-id").value = barber.id;
    document.getElementById("barber-name").value = barber.name;
    document.getElementById("barber-email").value = barber.login_email || "";
    document.getElementById("barber-specialties").value = barber.specialties ? barber.specialties.join(", ") : "";
    document.getElementById("barber-bio").value = barber.bio || "";

    document.getElementById("barber-email").setAttribute("disabled", "true");
    document.getElementById("barber-password").setAttribute("disabled", "true");
    document.getElementById("barber-password").removeAttribute("required");

    document.getElementById("btn-submit-barber").textContent = "Actualizar Barbero";
    document.getElementById("btn-cancel-barber").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const btnCancelBarber = document.getElementById("btn-cancel-barber");
  if (btnCancelBarber) {
    btnCancelBarber.addEventListener("click", () => {
      document.getElementById("barber-id").value = "";
      formManageBarber.reset();

      document.getElementById("barber-email").removeAttribute("disabled");
      document.getElementById("barber-password").removeAttribute("disabled");
      document.getElementById("barber-password").setAttribute("required", "true");

      document.getElementById("btn-submit-barber").textContent = "Crear Barbero";
      btnCancelBarber.style.display = "none";
    });
  }

  if (formManageBarber) {
    formManageBarber.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = formManageBarber.querySelector("button[type='submit']");
      btnSubmit.setAttribute("disabled", "true");
      btnSubmit.textContent = "Guardando...";

      const barberId = document.getElementById("barber-id").value;
      const name = document.getElementById("barber-name").value.trim();
      const email = document.getElementById("barber-email").value.trim();
      const password = document.getElementById("barber-password").value;
      const specString = document.getElementById("barber-specialties").value.trim();
      const specialties = specString ? specString.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const bio = document.getElementById("barber-bio").value.trim();

      try {
        if (barberId) {
          const { error } = await supabase.from("barbers").update({ name, specialties, bio }).eq("id", barberId);
          if (error) throw new Error("Error al actualizar: " + error.message);
          await showAlert("Barbero actualizado exitosamente.", "Barbero Actualizado", "check-circle");
        } else {
          const tempClient = window.SupabaseLib.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
            auth: { persistSession: false }
          });
          const { data: authData, error: authError } = await tempClient.auth.signUp({
            email,
            password
          });
          if (authError) throw new Error("Error al crear cuenta: " + authError.message);

          const newUserId = authData.user ? authData.user.id : null;
          const { error } = await supabase.from("barbers").insert([{
            user_id: newUserId,
            login_email: email,
            name,
            specialties,
            bio,
            active: true
          }]);
          if (error) throw new Error("Error al enlazar barbero: " + error.message);
          await showAlert("Barbero creado exitosamente con sus credenciales de acceso.", "Barbero Creado", "check-circle");
        }

        formManageBarber.reset();
        document.getElementById("barber-id").value = "";

        document.getElementById("barber-email").removeAttribute("disabled");
        document.getElementById("barber-password").removeAttribute("disabled");
        document.getElementById("barber-password").setAttribute("required", "true");

        if (btnCancelBarber) btnCancelBarber.style.display = "none";
        loadAdminBarbers();
      } catch (err) {
        await showAlert("Atención: " + err.message, "Atención", "alert-triangle");
      } finally {
        btnSubmit.removeAttribute("disabled");
        btnSubmit.textContent = document.getElementById("barber-id").value ? "Actualizar Barbero" : "Crear Barbero";
      }
    });
  }

  // --- 8.5 Gestión de Galería (Solo Super Admin) ---
  const formManageGallery = document.getElementById("form-manage-gallery");
  const listAdminGallery = document.getElementById("list-admin-gallery");
  let galleryArray = [];

  async function loadAdminGallery() {
    if (!listAdminGallery) return;
    try {
      const { data, error } = await supabase.from("settings").select("value").eq("id", "gallery_images").maybeSingle();
      if (error) throw error;

      galleryArray = data && data.value ? JSON.parse(data.value) : [];

      listAdminGallery.innerHTML = "";
      if (galleryArray.length === 0) {
        listAdminGallery.innerHTML = "<p class='text-muted' style='grid-column:1/-1;'>No hay fotos en la galería.</p>";
        return;
      }

      galleryArray.forEach((rawUrl, index) => {
        const safeUrl = sanitizeUrl(rawUrl, "", { allowDataImage: true });
        if (!safeUrl) return;
        const item = document.createElement("div");
        item.style.position = "relative";
        item.style.borderRadius = "8px";
        item.style.overflow = "hidden";
        item.style.border = "1px solid rgba(255,255,255,0.1)";
        item.innerHTML = `
          <img src="${escapeHtml(safeUrl)}" style="width:100%; height:120px; object-fit:cover; display:block;">
          <button class="btn-delete-gallery" data-index="${index}" style="position:absolute; top:4px; right:4px; background:var(--danger); border:none; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:white;">
            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
          </button>
        `;
        listAdminGallery.appendChild(item);
      });

      document.querySelectorAll(".btn-delete-gallery").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          if (!await showConfirm("¿Eliminar esta foto de la galería pública?", "Eliminar Foto", "trash-2")) return;
          const idx = Number(e.currentTarget.dataset.index);
          galleryArray.splice(idx, 1);
          await saveGallerySettings();
        });
      });

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error("Error cargando galería:", err.message);
    }
  }

  async function saveGallerySettings() {
    try {
      const { error } = await supabase.from("settings").upsert({
        id: "gallery_images",
        value: JSON.stringify(galleryArray)
      });
      if (error) throw error;
      loadAdminGallery();
    } catch (err) {
      await showAlert("Error actualizando galería: " + err.message, "Error de Galería", "alert-triangle");
    }
  }

  if (formManageGallery) {
    formManageGallery.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById("gallery-photo-file");
      if (!fileInput.files || fileInput.files.length === 0) return;

      const btnSubmit = formManageGallery.querySelector("button[type='submit']");
      const originalHtml = btnSubmit.innerHTML;
      btnSubmit.setAttribute("disabled", "true");
      btnSubmit.textContent = "Subiendo...";

      try {
        const file = fileInput.files[0];
        const fileExt = file.name.split(".").pop();
        const fileName = `gallery_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(fileName, file, { cacheControl: "3600", upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName);
        galleryArray.unshift(urlData.publicUrl);

        await saveGallerySettings();
        formManageGallery.reset();
      } catch (err) {
        await showAlert("Error al subir foto: " + err.message, "Error de Subida", "alert-triangle");
      } finally {
        btnSubmit.removeAttribute("disabled");
        btnSubmit.innerHTML = originalHtml;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  // --- 9. Configuración del Inicio (Solo Super Admin) ---
  async function loadAdminHomeConfig() {
    try {
      const { data: settings, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      if (!settings) return;

      settings.forEach((setting) => {
        if (setting.id === "logo_url" && setting.value.trim() !== "") {
          const previewImg = document.getElementById("logo-preview-img");
          const previewText = document.getElementById("logo-preview-text");
          const safeLogo = sanitizeUrl(setting.value, "", { allowDataImage: true });
          if (previewImg && previewText && safeLogo) {
            previewImg.src = safeLogo;
            previewImg.style.display = "block";
            previewText.style.display = "none";
          }
        } else if (setting.id === "closed_days") {
          const sundayCheck = document.getElementById("set-sunday_closed");
          if (sundayCheck) {
            const closed = parseClosedDays(setting.value);
            sundayCheck.checked = closed.includes(0);
          }
        } else {
          const el = document.getElementById(`set-${setting.id}`);
          if (el) el.value = setting.value;
        }
      });
    } catch (err) {
      console.error("Error cargando config de inicio:", err.message);
    }
  }

  if (formManageHome) {
    const btnGetGps = document.getElementById("btn-get-gps");
    if (btnGetGps) {
      btnGetGps.addEventListener("click", async (e) => {
        e.preventDefault();
        await showAlert("Obteniendo ubicación del dispositivo...", "Geolocalización", "map-pin");

        if (!navigator.geolocation) {
          await showAlert("Tu navegador no soporta geolocalización o necesitas usar HTTPS.", "Geolocalización", "alert-triangle");
          return;
        }

        btnGetGps.innerHTML = `<i data-lucide="loader" class="spin" style="width:18px; height:18px; display:inline-block; vertical-align:middle;"></i> ...`;
        if (window.lucide) window.lucide.createIcons();

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const mapInput = document.getElementById("set-map_url");

            if (mapInput) {
              mapInput.value = `https://maps.google.com/maps?q=${lat},${lng}&hl=es&z=16&output=embed`;
            }

            btnGetGps.innerHTML = `<i data-lucide="check" style="stroke:#10B981; width:18px; height:18px; display:inline-block; vertical-align:middle;"></i> OK`;
            if (window.lucide) window.lucide.createIcons();
          },
          async (err) => {
            await showAlert("No se pudo obtener la ubicación: Permiso denegado o error (" + err.message + ")", "Error de GPS", "alert-triangle");
            btnGetGps.innerHTML = `<i data-lucide="map-pin" style="width:18px; height:18px; display:inline-block; vertical-align:middle;"></i> Mi GPS`;
            if (window.lucide) window.lucide.createIcons();
          },
          { enableHighAccuracy: true }
        );
      });
    }

    formManageHome.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = formManageHome.querySelector("button[type='submit']");
      btnSubmit.setAttribute("disabled", "true");
      btnSubmit.textContent = "Guardando...";

      const fileInput = document.getElementById("set-logo_file");
      let logoUrl = null;

      try {
        if (fileInput && fileInput.files.length > 0) {
          btnSubmit.textContent = "Subiendo imagen...";
          const file = fileInput.files[0];
          const fileExt = file.name.split(".").pop();
          const fileName = `logo_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("logos")
            .upload(fileName, file, { cacheControl: "3600", upsert: true });

          if (uploadError) throw new Error("Error subiendo imagen a la nube: " + uploadError.message);

          const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName);
          logoUrl = urlData.publicUrl;
        }

        const ids = [
          "hero_subtitle",
          "hero_title",
          "hero_desc",
          "info_address",
          "info_hours_wk",
          "info_hours_we",
          "social_whatsapp",
          "social_instagram",
          "facebook_url",
          "map_url",
          "schedule_start",
          "schedule_end",
          "schedule_interval"
        ];
        const updates = ids
          .filter((id) => document.getElementById(`set-${id}`))
          .map((id) => ({ id, value: document.getElementById(`set-${id}`).value.trim() }));

        const sundayCheck = document.getElementById("set-sunday_closed");
        if (sundayCheck) {
          updates.push({
            id: "closed_days",
            value: JSON.stringify(sundayCheck.checked ? [0] : [])
          });
        }

        if (logoUrl) {
          updates.push({ id: "logo_url", value: logoUrl });
        }

        btnSubmit.textContent = "Guardando configuración...";
        const { error } = await supabase.from("settings").upsert(updates);
        if (error) throw error;

        await showAlert("Configuración guardada correctamente.", "Configuración Guardada", "check-circle");

        if (logoUrl) {
          const previewImg = document.getElementById("logo-preview-img");
          const previewText = document.getElementById("logo-preview-text");
          if (previewImg && previewText) {
            previewImg.src = logoUrl;
            previewImg.style.display = "block";
            previewText.style.display = "none";
          }
          fileInput.value = "";
        }
      } catch (err) {
        await showAlert("Error guardando configuración: " + err.message, "Error al Guardar", "alert-triangle");
      } finally {
        btnSubmit.removeAttribute("disabled");
        btnSubmit.textContent = "Guardar Configuración";
      }
    });
  }

  // --- 10. Cierre de Sesión ---
  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error al cerrar sesión:", err.message);
    } finally {
      window.location.reload();
    }
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // --- 11. Módulo de Reportes de Producción de Barberos (Super Admin) ---
  let isReportsTabInitialized = false;

  async function initReportsTab() {
    const reportBarberSelect = document.getElementById("report-barber");
    const reportPeriodSelect = document.getElementById("report-period");
    const reportCustomDates = document.getElementById("report-custom-dates");
    const btnGenerateReport = document.getElementById("btn-generate-report");

    if (!reportBarberSelect || !reportPeriodSelect || !reportCustomDates || !btnGenerateReport) return;

    if (!isReportsTabInitialized) {
      reportPeriodSelect.addEventListener("change", (e) => {
        reportCustomDates.style.display = e.target.value === "custom" ? "grid" : "none";
      });

      btnGenerateReport.addEventListener("click", (e) => {
        e.preventDefault();
        generateReport();
      });

      isReportsTabInitialized = true;
    }

    const todayStr = getLocalDateStr();
    document.getElementById("report-start-date").value = todayStr;
    document.getElementById("report-end-date").value = todayStr;

    try {
      const { data: barbers, error } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("active", true);

      if (error) throw error;

      reportBarberSelect.innerHTML = `<option value="all">Todos los Barberos</option>`;
      if (barbers) {
        barbers.forEach((barber) => {
          const opt = document.createElement("option");
          opt.value = barber.id;
          opt.textContent = barber.name;
          reportBarberSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error("Error cargando barberos para reportes:", err.message);
    }

    generateReport();
  }

  async function generateReport() {
    const barberId = document.getElementById("report-barber").value;
    const period = document.getElementById("report-period").value;
    const btnSubmit = document.getElementById("btn-generate-report");

    const statCount = document.getElementById("report-stat-count");
    const statCompleted = document.getElementById("report-stat-completed");
    const statCancelled = document.getElementById("report-stat-cancelled");
    const statEarnings = document.getElementById("report-stat-earnings");
    const statAttendance = document.getElementById("report-stat-attendance");
    const tableBody = document.getElementById("report-table-body");
    const detailsContainer = document.getElementById("report-details-container");
    const detailsList = document.getElementById("report-details-list");
    const tableTitle = document.getElementById("report-table-title");

    if (!statCount || !statCompleted || !statCancelled || !statEarnings || !statAttendance || !tableBody || !detailsContainer || !detailsList) return;

    btnSubmit.setAttribute("disabled", "true");
    const originalHtml = btnSubmit.innerHTML;
    btnSubmit.innerHTML = `<i data-lucide="loader" class="spin" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Generando...`;
    if (window.lucide) window.lucide.createIcons();

    let startDate = "";
    let endDate = "";
    const today = new Date();
    const todayStr = getLocalDateStr(today);

    if (period === "today") {
      startDate = todayStr;
      endDate = todayStr;
    } else if (period === "week") {
      startDate = getLocalDateOffset(-7);
      endDate = todayStr;
    } else if (period === "month") {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      startDate = `${year}-${month}-01`;
      endDate = todayStr;
    } else if (period === "custom") {
      startDate = document.getElementById("report-start-date").value;
      endDate = document.getElementById("report-end-date").value;
      if (!startDate || !endDate) {
        await showAlert("Por favor ingresa ambas fechas para el rango personalizado.", "Rango de Fechas Requerido", "info");
        btnSubmit.removeAttribute("disabled");
        btnSubmit.innerHTML = originalHtml;
        return;
      }
    }

    try {
      let query = supabase
        .from("appointments")
        .select(`
          *,
          barbers ( id, name ),
          services ( name, price )
        `)
        .gte("appointment_date", startDate)
        .lte("appointment_date", endDate);

      if (barberId !== "all") {
        query = query.eq("barber_id", barberId);
      }

      const { data: appointments, error } = await query;
      if (error) throw error;

      const totalCitas = appointments.length;
      let completadasCount = 0;
      let canceladasCount = 0;
      let totalRecaudado = 0;

      const barberStats = {};
      const barberOptions = Array.from(document.getElementById("report-barber").options);
      barberOptions.forEach((opt) => {
        if (opt.value !== "all") {
          if (barberId !== "all" && opt.value !== barberId) return;
          barberStats[opt.value] = {
            name: opt.textContent,
            completed: 0,
            cancelled: 0,
            scheduled: 0,
            totalEarnings: 0
          };
        }
      });

      appointments.forEach((app) => {
        const appBarberId = app.barber_id;
        const appStatus = app.status;
        const price = app.services ? parseFloat(app.services.price) : 0;

        if (appBarberId && !barberStats[appBarberId]) {
          barberStats[appBarberId] = {
            name: app.barbers ? app.barbers.name : "Sin Asignar",
            completed: 0,
            cancelled: 0,
            scheduled: 0,
            totalEarnings: 0
          };
        }

        const statsObj = appBarberId ? barberStats[appBarberId] : null;

        if (appStatus === "completed") {
          completadasCount++;
          totalRecaudado += price;
          if (statsObj) {
            statsObj.completed++;
            statsObj.totalEarnings += price;
          }
        } else if (appStatus === "cancelled") {
          canceladasCount++;
          if (statsObj) statsObj.cancelled++;
        } else {
          if (statsObj) statsObj.scheduled++;
        }
      });

      statCount.textContent = totalCitas;
      statCompleted.textContent = completadasCount;
      statCancelled.textContent = canceladasCount;
      statEarnings.textContent = `$${formatPrice(totalRecaudado)}`;

      const totalFinalizadas = completadasCount + canceladasCount;
      const attendancePercent = totalFinalizadas > 0
        ? Math.round((completadasCount / totalFinalizadas) * 100)
        : 0;
      statAttendance.textContent = `${attendancePercent}%`;

      tableBody.innerHTML = "";

      let grandTotalCompleted = 0;
      let grandTotalCancelled = 0;
      let grandTotalScheduled = 0;
      let grandTotalEarnings = 0;

      Object.keys(barberStats).forEach((bId) => {
        const stats = barberStats[bId];
        const row = document.createElement("tr");

        grandTotalCompleted += stats.completed;
        grandTotalCancelled += stats.cancelled;
        grandTotalScheduled += stats.scheduled;
        grandTotalEarnings += stats.totalEarnings;

        row.innerHTML = `
          <td data-label="Barbero" style="padding: 12px 8px; font-weight: 500;">${escapeHtml(stats.name)}</td>
          <td data-label="Completadas" style="padding: 12px 8px; text-align: center;">${stats.completed}</td>
          <td data-label="Canceladas" style="padding: 12px 8px; text-align: center; color: ${stats.cancelled > 0 ? "var(--danger)" : "var(--text-secondary)"};">${stats.cancelled}</td>
          <td data-label="Agendadas" style="padding: 12px 8px; text-align: center; color: ${stats.scheduled > 0 ? "var(--primary)" : "var(--text-secondary)"};">${stats.scheduled}</td>
          <td data-label="Total Producido" style="padding: 12px 8px; text-align: right; font-weight: 600; color: var(--primary);">$${formatPrice(stats.totalEarnings)}</td>
        `;
        tableBody.appendChild(row);
      });

      if (barberId === "all" && Object.keys(barberStats).length > 0) {
        const tfoot = document.createElement("tr");
        tfoot.style.cssText = "border-top: 2px solid rgba(255,255,255,0.1); font-weight: 700; background-color: rgba(255, 255, 255, 0.01);";
        tfoot.innerHTML = `
          <td data-label="Resumen" style="padding: 14px 8px; color: var(--text-primary);">TOTAL GENERAL</td>
          <td data-label="Completadas" style="padding: 14px 8px; text-align: center; color: var(--success);">${grandTotalCompleted}</td>
          <td data-label="Canceladas" style="padding: 14px 8px; text-align: center; color: var(--danger);">${grandTotalCancelled}</td>
          <td data-label="Agendadas" style="padding: 14px 8px; text-align: center; color: var(--primary);">${grandTotalScheduled}</td>
          <td data-label="Total Producido" style="padding: 14px 8px; text-align: right; color: var(--primary);">$${formatPrice(grandTotalEarnings)}</td>
        `;
        tableBody.appendChild(tfoot);
      }

      if (Object.keys(barberStats).length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align: center; padding: 20px;">No hay datos de barberos para mostrar.</td></tr>`;
      }

      if (barberId !== "all") {
        tableTitle.textContent = "Resumen del Barbero";
        detailsContainer.style.display = "block";
        detailsList.innerHTML = "";

        if (appointments.length === 0) {
          detailsList.innerHTML = "<p class='text-muted' style='text-align: center; padding: 20px 0;'>No se encontraron citas en este período para el barbero.</p>";
        } else {
          appointments.sort((a, b) => {
            const dateA = new Date(a.appointment_date + "T" + a.appointment_time);
            const dateB = new Date(b.appointment_date + "T" + b.appointment_time);
            return dateB - dateA;
          });

          appointments.forEach((app) => {
            const card = renderAppointmentCard(app, {
              showDate: true,
              highlightPending: false,
              showActions: false,
              showBarber: false
            });
            detailsList.appendChild(card);
          });
        }
      } else {
        tableTitle.textContent = "Desglose de Producción";
        detailsContainer.style.display = "none";
      }
    } catch (err) {
      console.error("Error al generar reporte:", err.message);
      await showAlert("Error al cargar datos del reporte: " + err.message, "Error de Reporte", "alert-triangle");
    } finally {
      btnSubmit.removeAttribute("disabled");
      btnSubmit.innerHTML = originalHtml;
      if (window.lucide) window.lucide.createIcons();
    }
  }
});
