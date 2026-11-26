// =========================================================================
// LÓGICA DE RESERVAS Y NAVEGACIÓN CLIENTE
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const {
    escapeHtml,
    sanitizeUrl,
    getLocalDateStr,
    timeToMinutes,
    minutesToTime,
    formatPrice,
    parseClosedDays
  } = window.AppUtils;

  // --- Estado de la Cita y Configuración de Horarios ---
  const bookingState = {
    serviceId: null,
    serviceName: "",
    servicePrice: 0,
    serviceDuration: 30,
    barberId: null,
    barberName: "",
    selectedDate: "",
    selectedTime: ""
  };

  const scheduleConfig = {
    start: "09:00",
    end: "18:00",
    interval: 30,
    closedDays: [0]
  };

  let servicesCache = null;
  let barbersCache = null;
  let isCustomDateListenerBound = false;

  const MY_APPOINTMENTS_KEY = "shopbarber_my_appointments_v1";
  const CLIENT_PROFILE_KEY = "shopbarber_client_profile_v1";

  // --- Elementos del DOM ---
  const viewHome = document.getElementById("home-view");
  const viewBooking = document.getElementById("booking-view");
  const viewMyAppointments = document.getElementById("my-appointments-view");
  const viewGallery = document.getElementById("gallery-view");
  const viewInfo = document.getElementById("info-view");

  const navHome = document.getElementById("nav-home");
  const navBooking = document.getElementById("nav-booking");
  const navMyAppointments = document.getElementById("nav-my-appointments");
  const navGallery = document.getElementById("nav-gallery");
  const navInfo = document.getElementById("nav-info");

  const servicesContainer = document.getElementById("services-container");
  const barbersContainer = document.getElementById("barbers-container");
  const dateScrollContainer = document.getElementById("date-scroll-container");
  const timeGridContainer = document.getElementById("time-grid-container");

  const formClient = document.getElementById("booking-client-form");
  const summaryDetails = document.getElementById("summary-details");
  const confirmationDetails = document.getElementById("confirmation-details");

  // Pasos del Wizard de Reservas
  const steps = [
    { indicator: "step-1", pane: "pane-service" },
    { indicator: "step-2", pane: "pane-barber" },
    { indicator: "step-3", pane: "pane-time" },
    { indicator: "step-4", pane: "pane-details" },
    { indicator: "step-5", pane: "pane-confirm" }
  ];
  let currentStepIndex = 0;

  // --- 1. Lógica de Pestañas (Bottom Navigation) ---
  function switchView(viewName) {
    const views = {
      home: viewHome,
      booking: viewBooking,
      "my-appointments": viewMyAppointments,
      gallery: viewGallery,
      info: viewInfo
    };

    const navs = {
      home: navHome,
      booking: navBooking,
      "my-appointments": navMyAppointments,
      gallery: navGallery,
      info: navInfo
    };

    Object.values(views).forEach((v) => { if (v) v.classList.remove("active"); });
    Object.values(navs).forEach((n) => { if (n) n.classList.remove("active"); });

    const barberProfileView = document.getElementById("barber-profile-view");
    if (barberProfileView) barberProfileView.classList.remove("active");

    if (views[viewName]) views[viewName].classList.add("active");
    if (navs[viewName]) navs[viewName].classList.add("active");

    window.location.hash = "#" + viewName;
  }

  if (navHome) navHome.addEventListener("click", (e) => { e.preventDefault(); switchView("home"); });
  if (navBooking) navBooking.addEventListener("click", (e) => { e.preventDefault(); switchView("booking"); resetBookingWizard(); });
  if (navMyAppointments) navMyAppointments.addEventListener("click", (e) => { e.preventDefault(); switchView("my-appointments"); loadMyAppointments(); });
  if (navGallery) navGallery.addEventListener("click", (e) => { e.preventDefault(); switchView("gallery"); });
  if (navInfo) navInfo.addEventListener("click", (e) => { e.preventDefault(); switchView("info"); });

  // Manejar hash inicial al cargar
  const hash = window.location.hash;
  if (hash === "#booking") {
    switchView("booking");
    resetBookingWizard();
  } else if (hash === "#my-appointments") {
    switchView("my-appointments");
  } else if (hash === "#gallery") {
    switchView("gallery");
  } else if (hash === "#info") {
    switchView("info");
  } else {
    switchView("home");
  }

  // --- Comprobar Sesión para Menú Admin ---
  async function checkAdminMenu() {
    try {
      const { data } = await supabase.auth.getSession();
      const navAdmin = document.getElementById("nav-admin");
      if (navAdmin) {
        navAdmin.style.display = (data && data.session) ? "flex" : "none";
      }
    } catch (_) {}
  }
  checkAdminMenu();

  // --- Actualizar botón "Cómo Llegar" ---
  function updateDirectionsLink(mapUrl, address) {
    const btnDirections = document.getElementById("btn-how-to-get-there");
    if (!btnDirections) return;

    let targetHref = "";
    if (mapUrl) {
      try {
        const parsed = new URL(mapUrl);
        const queryParam = parsed.searchParams.get("q");
        if (queryParam) {
          targetHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParam)}`;
        } else {
          targetHref = sanitizeUrl(mapUrl, "");
        }
      } catch (_) {}
    }

    if (!targetHref && address) {
      targetHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }

    if (targetHref) {
      btnDirections.href = targetHref;
    }
  }

  // --- Cargar configuraciones del Home dinámicamente ---
  async function loadHomeSettings() {
    try {
      const { data: settings, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      if (!settings || settings.length === 0) return;

      let hasSocialLinks = false;
      let loadedMapUrl = "";
      let loadedAddress = "";

      settings.forEach((setting) => {
        const val = (setting.value || "").trim();

        if (setting.id === "social_whatsapp") {
          window.shopWhatsappNumber = val;
        }

        if (setting.id === "schedule_start" && /^\d{2}:\d{2}$/.test(val)) {
          scheduleConfig.start = val;
        } else if (setting.id === "schedule_end" && /^\d{2}:\d{2}$/.test(val)) {
          scheduleConfig.end = val;
        } else if (setting.id === "schedule_interval") {
          const parsedInt = parseInt(val, 10);
          if (parsedInt >= 10 && parsedInt <= 120) scheduleConfig.interval = parsedInt;
        } else if (setting.id === "closed_days") {
          scheduleConfig.closedDays = parseClosedDays(val);
        } else if (setting.id.startsWith("social_")) {
          const network = setting.id.replace("social_", "");
          const linkEl = document.getElementById(`link-${network}`);
          if (linkEl && val !== "") {
            const safeHref = network === "whatsapp"
              ? `https://wa.me/${val.replace(/\D/g, "")}`
              : sanitizeUrl(val, "");
            if (safeHref && safeHref !== "https://wa.me/") {
              linkEl.href = safeHref;
              linkEl.style.display = "flex";
              hasSocialLinks = true;
            }
          }
        } else if (setting.id === "facebook_url") {
          const linkEl = document.getElementById("link-facebook");
          if (linkEl && val !== "") {
            const safeHref = sanitizeUrl(val, "");
            if (safeHref) {
              linkEl.href = safeHref;
              linkEl.style.display = "flex";
              hasSocialLinks = true;
            }
          }
        } else if (setting.id === "map_url") {
          loadedMapUrl = val;
          const mapIframe = document.getElementById("map-iframe");
          const safeMapUrl = sanitizeUrl(val, "");
          if (mapIframe && safeMapUrl) {
            mapIframe.src = safeMapUrl;
          }
        } else if (setting.id === "logo_url") {
          const logoContainer = document.getElementById("dyn-logo-container");
          const safeLogo = sanitizeUrl(val, "", { allowDataImage: true });
          if (logoContainer && safeLogo) {
            logoContainer.innerHTML = "";
            const img = document.createElement("img");
            img.src = safeLogo;
            img.alt = "Logo";
            img.style.cssText = "max-height: 45px; width: auto; object-fit: contain;";
            logoContainer.appendChild(img);
          }
        } else if (setting.id === "gallery_images") {
          const dynGallery = document.getElementById("dyn-gallery-container");
          if (dynGallery && val) {
            let urls = [];
            try { urls = JSON.parse(val); } catch (_) { urls = []; }
            dynGallery.innerHTML = "";
            if (!Array.isArray(urls) || urls.length === 0) {
              dynGallery.innerHTML = "<p class='text-muted' style='grid-column: 1 / -1; text-align: center;'>No hay fotos publicadas en el portafolio.</p>";
            } else {
              urls.forEach((rawUrl) => {
                const safeImgUrl = sanitizeUrl(rawUrl, "", { allowDataImage: true });
                if (!safeImgUrl) return;
                const img = document.createElement("img");
                img.src = safeImgUrl;
                img.alt = "Trabajo de barbería";
                img.style.width = "100%";
                img.style.height = "150px";
                img.style.objectFit = "cover";
                img.style.borderRadius = "8px";
                dynGallery.appendChild(img);
              });
            }
            if (typeof window.refreshGalleryLightbox === "function") {
              window.refreshGalleryLightbox();
            }
          }
        } else {
          if (setting.id === "info_address") loadedAddress = val;
          const el = document.getElementById(`dyn-${setting.id}`);
          if (el) {
            el.textContent = setting.value;
          }
        }
      });

      updateDirectionsLink(loadedMapUrl, loadedAddress);

      const dynGallery = document.getElementById("dyn-gallery-container");
      if (dynGallery && dynGallery.innerHTML.includes("Cargando portafolio...")) {
        dynGallery.innerHTML = "<p class='text-muted' style='grid-column: 1 / -1; text-align: center;'>No hay fotos publicadas en el portafolio.</p>";
      }

      if (hasSocialLinks) {
        const socialCard = document.getElementById("social-media-card");
        if (socialCard) socialCard.style.display = "block";
      }
    } catch (err) {
      console.error("Error cargando configuraciones del Home:", err.message);
    }
  }

  // --- Cargar Equipo (Barberos) ---
  async function loadTeam() {
    const teamContainer = document.getElementById("team-container");
    if (!teamContainer) return;
    try {
      const { data: barbers, error } = await supabase.from("barbers").select("*").eq("active", true);
      if (error) throw error;

      barbersCache = barbers || [];

      if (barbersCache.length === 0) {
        teamContainer.innerHTML = "<p class='text-muted'>No hay barberos registrados.</p>";
        return;
      }

      teamContainer.innerHTML = "";
      barbersCache.forEach((barber) => {
        const specText = Array.isArray(barber.specialties) && barber.specialties.length > 0
          ? barber.specialties.join(" • ")
          : "Estilista";
        const safePhoto = sanitizeUrl(barber.photo_url, "", { allowDataImage: true });
        const avatarHtml = safePhoto
          ? `<img src="${escapeHtml(safePhoto)}" alt="${escapeHtml(barber.name)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
          : `<i data-lucide="user" style="stroke:var(--primary); width:20px; height:20px;"></i>`;

        const barberCard = document.createElement("div");
        barberCard.style.cssText = "display:flex; align-items:center; gap:12px; background:var(--bg-surface); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); cursor:pointer; transition: transform 0.2s, background 0.2s;";
        barberCard.onmouseover = () => { barberCard.style.background = "var(--bg-surface-elevated)"; };
        barberCard.onmouseout = () => { barberCard.style.background = "var(--bg-surface)"; };

        barberCard.innerHTML = `
          <div style="width:40px; height:40px; border-radius:50%; background:var(--bg-surface-elevated); display:flex; align-items:center; justify-content:center; overflow:hidden;">
            ${avatarHtml}
          </div>
          <div>
            <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(barber.name)}</div>
            <div style="font-size:0.8rem; color:var(--primary);">${escapeHtml(specText)}</div>
          </div>
        `;

        barberCard.addEventListener("click", () => showBarberProfile(barber));
        teamContainer.appendChild(barberCard);
      });

      if (window.lucide) window.lucide.createIcons();

      function showBarberProfile(barber) {
        document.getElementById("bp-name").textContent = barber.name || "";
        document.getElementById("bp-specialties").textContent = Array.isArray(barber.specialties) && barber.specialties.length > 0
          ? barber.specialties.join(" • ")
          : "Estilista";
        document.getElementById("bp-bio").textContent = barber.bio || "Biografía no disponible.";

        const photoEl = document.getElementById("bp-photo");
        const base = window.SITE_BASEURL || "";
        const safePhoto = sanitizeUrl(barber.photo_url, `${base}/assets/img/barber.png`, { allowDataImage: true });
        photoEl.src = safePhoto;
        photoEl.style.display = "inline-block";

        document.querySelectorAll(".app-view").forEach((v) => {
          v.style.display = "";
          v.classList.remove("active");
        });
        document.getElementById("barber-profile-view").classList.add("active");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      const btnBackProfile = document.getElementById("btn-back-barber-profile");
      if (btnBackProfile && !btnBackProfile.dataset.bound) {
        btnBackProfile.dataset.bound = "1";
        btnBackProfile.addEventListener("click", () => {
          document.querySelectorAll(".app-view").forEach((v) => {
            v.style.display = "";
            v.classList.remove("active");
          });
          document.getElementById("info-view").classList.add("active");
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }
    } catch (err) {
      console.error("Error cargando equipo:", err.message);
    }
  }

  // --- 2. Carga de Datos desde Supabase (Reservas) ---
  async function loadServices(forceRefresh = false) {
    try {
      if (!servicesCache || forceRefresh) {
        const { data: services, error } = await supabase
          .from("services")
          .select("*")
          .eq("active", true);
        if (error) throw error;
        servicesCache = services || [];
      }

      servicesContainer.innerHTML = "";
      if (servicesCache.length === 0) {
        servicesContainer.innerHTML = "<p class='text-muted'>No hay servicios disponibles.</p>";
        return;
      }

      servicesCache.forEach((service) => {
        const item = document.createElement("div");
        item.className = "service-item";
        if (String(bookingState.serviceId) === String(service.id)) {
          item.classList.add("selected");
        }
        item.dataset.id = service.id;

        item.innerHTML = `
          <div class="service-info">
            <span class="service-name">${escapeHtml(service.name)}</span>
            <span class="service-meta">${Number(service.duration_minutes) || 30} min • ${escapeHtml(service.description || "")}</span>
          </div>
          <span class="service-price">$${formatPrice(service.price)}</span>
        `;

        item.addEventListener("click", () => {
          document.querySelectorAll(".service-item").forEach((i) => i.classList.remove("selected"));
          item.classList.add("selected");
          bookingState.serviceId = service.id;
          bookingState.serviceName = service.name;
          bookingState.servicePrice = service.price;
          bookingState.serviceDuration = Number(service.duration_minutes) || 30;
          bookingState.selectedTime = "";
          document.getElementById("btn-to-step4").setAttribute("disabled", "true");
          document.getElementById("btn-to-step2").removeAttribute("disabled");
        });

        servicesContainer.appendChild(item);
      });
    } catch (err) {
      console.error("Error cargando servicios:", err.message);
      servicesContainer.innerHTML = "<p class='text-danger'>Error al conectar con la base de datos.</p>";
    }
  }

  async function loadBarbers(forceRefresh = false) {
    try {
      if (!barbersCache || forceRefresh) {
        const { data: barbers, error } = await supabase
          .from("barbers")
          .select("*")
          .eq("active", true);
        if (error) throw error;
        barbersCache = barbers || [];
      }

      barbersContainer.innerHTML = "";
      if (barbersCache.length === 0) {
        barbersContainer.innerHTML = "<p class='text-muted'>No hay barberos disponibles.</p>";
        return;
      }

      const base = window.SITE_BASEURL || "";
      const defaultAvatar = `${base}/assets/img/barber.png`;

      barbersCache.forEach((barber) => {
        const item = document.createElement("div");
        item.className = "barber-item";
        if (String(bookingState.barberId) === String(barber.id)) {
          item.classList.add("selected");
        }
        item.dataset.id = barber.id;

        const specialtiesList = Array.isArray(barber.specialties) && barber.specialties.length > 0
          ? barber.specialties.join(", ")
          : "Cortes en general";
        const avatarSrc = sanitizeUrl(barber.photo_url, defaultAvatar, { allowDataImage: true });

        item.innerHTML = `
          <div class="barber-profile-row">
            <img class="barber-avatar" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(barber.name)}">
            <div class="barber-info">
              <span class="barber-name">${escapeHtml(barber.name)}</span>
              <span class="service-meta">${escapeHtml(specialtiesList)}</span>
            </div>
          </div>
        `;

        item.addEventListener("click", () => {
          document.querySelectorAll(".barber-item").forEach((i) => i.classList.remove("selected"));
          item.classList.add("selected");
          bookingState.barberId = barber.id;
          bookingState.barberName = barber.name;
          bookingState.selectedTime = "";
          document.getElementById("btn-to-step4").setAttribute("disabled", "true");
          document.getElementById("btn-to-step3").removeAttribute("disabled");
        });

        barbersContainer.appendChild(item);
      });
    } catch (err) {
      console.error("Error cargando barberos:", err.message);
      barbersContainer.innerHTML = "<p class='text-danger'>Error al conectar con la base de datos.</p>";
    }
  }

  // --- 3. Lógica del Calendario Táctil y Horarios ---
  function buildDateSelector() {
    dateScrollContainer.innerHTML = "";
    const daysName = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      if (scheduleConfig.closedDays.includes(date.getDay())) continue;

      const dayName = daysName[date.getDay()];
      const dayNum = date.getDate();
      const dateStr = getLocalDateStr(date);

      const bubble = document.createElement("div");
      bubble.className = "date-bubble";
      if (bookingState.selectedDate === dateStr) {
        bubble.classList.add("selected");
      }
      bubble.dataset.date = dateStr;
      bubble.innerHTML = `
        <span class="date-bubble-dayname">${dayName}</span>
        <span class="date-bubble-day">${dayNum}</span>
      `;

      bubble.addEventListener("click", () => {
        document.querySelectorAll(".date-bubble").forEach((b) => b.classList.remove("selected"));
        bubble.classList.add("selected");
        bookingState.selectedDate = dateStr;
        bookingState.selectedTime = "";
        const customInput = document.getElementById("booking-custom-date");
        if (customInput) customInput.value = dateStr;
        document.getElementById("btn-to-step4").setAttribute("disabled", "true");
        loadAvailableTimes();
      });

      dateScrollContainer.appendChild(bubble);
    }

    const customDateInput = document.getElementById("booking-custom-date");
    if (customDateInput) {
      const today = getLocalDateStr();
      customDateInput.min = today;
      customDateInput.value = bookingState.selectedDate || "";

      if (!isCustomDateListenerBound) {
        isCustomDateListenerBound = true;
        customDateInput.addEventListener("change", (e) => {
          const selectedDate = e.target.value;
          if (!selectedDate) return;

          document.querySelectorAll(".date-bubble").forEach((b) => {
            b.classList.toggle("selected", b.dataset.date === selectedDate);
          });

          bookingState.selectedDate = selectedDate;
          bookingState.selectedTime = "";
          document.getElementById("btn-to-step4").setAttribute("disabled", "true");
          loadAvailableTimes();
        });
      }
    }
  }

  async function fetchBusyIntervals(barberId, dateStr) {
    // Usar función RPC segura para no exponer datos de clientes en el cliente público
    if (typeof supabase.rpc === "function") {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_busy_slots", {
        p_barber_id: barberId,
        p_date: dateStr
      });

      if (!rpcErr && Array.isArray(rpcData)) {
        return rpcData.map((row) => {
          const start = timeToMinutes(row.appointment_time);
          const duration = Number(row.duration_minutes) || 30;
          return { start, end: start + duration };
        });
      }
    }

    // Fallback compatible si la RPC aún no existe en la instancia remota
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("appointment_time, services ( duration_minutes )")
      .eq("barber_id", barberId)
      .eq("appointment_date", dateStr)
      .neq("status", "cancelled");

    if (error) throw error;

    return (appointments || []).map((app) => {
      const start = timeToMinutes(app.appointment_time);
      const duration = app.services && app.services.duration_minutes
        ? Number(app.services.duration_minutes)
        : 30;
      return { start, end: start + duration };
    });
  }

  async function loadAvailableTimes() {
    if (!bookingState.barberId || !bookingState.selectedDate) return;

    const chosenDateObj = new Date(bookingState.selectedDate + "T00:00:00");
    if (scheduleConfig.closedDays.includes(chosenDateObj.getDay())) {
      timeGridContainer.innerHTML = "<p class='text-muted' style='grid-column:1/-1;'>La barbería permanece cerrada este día. Por favor elige otra fecha.</p>";
      return;
    }

    timeGridContainer.innerHTML = "<p class='text-muted'>Cargando horarios...</p>";

    try {
      const busyIntervals = await fetchBusyIntervals(bookingState.barberId, bookingState.selectedDate);

      const startMin = timeToMinutes(scheduleConfig.start);
      const endMin = timeToMinutes(scheduleConfig.end);
      const stepMin = scheduleConfig.interval || 30;
      const serviceDur = bookingState.serviceDuration || 30;

      const todayStr = getLocalDateStr();
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const isToday = bookingState.selectedDate === todayStr;

      const slots = [];
      for (let m = startMin; m + serviceDur <= endMin; m += stepMin) {
        slots.push(m);
      }

      timeGridContainer.innerHTML = "";
      if (slots.length === 0) {
        timeGridContainer.innerHTML = "<p class='text-muted' style='grid-column:1/-1;'>No hay horarios configurados para este servicio.</p>";
        return;
      }

      slots.forEach((slotStart) => {
        const slotEnd = slotStart + serviceDur;
        const slotStr = minutesToTime(slotStart);
        const overlapsExisting = busyIntervals.some(
          (busy) => slotStart < busy.end && slotEnd > busy.start
        );
        const isPastToday = isToday && slotStart <= nowMinutes;
        const isUnavailable = overlapsExisting || isPastToday;

        const bubble = document.createElement("div");
        bubble.className = `time-bubble ${isUnavailable ? "disabled" : ""}`;
        if (!isUnavailable && bookingState.selectedTime === slotStr) {
          bubble.classList.add("selected");
        }
        bubble.textContent = slotStr;

        if (!isUnavailable) {
          bubble.addEventListener("click", () => {
            document.querySelectorAll(".time-bubble").forEach((tb) => tb.classList.remove("selected"));
            bubble.classList.add("selected");
            bookingState.selectedTime = slotStr;
            document.getElementById("btn-to-step4").removeAttribute("disabled");
          });
        }

        timeGridContainer.appendChild(bubble);
      });
    } catch (err) {
      console.error("Error cargando horarios:", err.message);
      timeGridContainer.innerHTML = "<p class='text-danger'>Error al cargar horarios.</p>";
    }
  }

  // --- 4. Control de Pasos (Wizard Navigation) ---
  function goToStep(stepIndex) {
    if (stepIndex < 0 || stepIndex >= steps.length) return;

    const prevStep = steps[currentStepIndex];
    document.getElementById(prevStep.pane).classList.remove("active");
    document.getElementById(prevStep.indicator).classList.remove("active");
    if (stepIndex > currentStepIndex) {
      document.getElementById(prevStep.indicator).classList.add("completed");
    } else {
      document.getElementById(steps[stepIndex].indicator).classList.remove("completed");
    }

    currentStepIndex = stepIndex;
    const newStep = steps[currentStepIndex];
    document.getElementById(newStep.pane).classList.add("active");
    document.getElementById(newStep.indicator).classList.add("active");

    if (newStep.pane === "pane-service") {
      loadServices();
    } else if (newStep.pane === "pane-barber") {
      loadBarbers();
    } else if (newStep.pane === "pane-time") {
      buildDateSelector();
      if (bookingState.selectedDate) {
        loadAvailableTimes();
      } else {
        timeGridContainer.innerHTML = "<p class='text-muted'>Por favor selecciona una fecha arriba.</p>";
      }
    } else if (newStep.pane === "pane-details") {
      // Autocompletar último contacto guardado si los campos están vacíos
      const savedProfile = readSavedClientProfile();
      const nameInput = document.getElementById("client-name");
      const phoneInput = document.getElementById("client-phone");
      const emailInput = document.getElementById("client-email");
      if (savedProfile) {
        if (nameInput && !nameInput.value) nameInput.value = savedProfile.name || "";
        if (phoneInput && !phoneInput.value) phoneInput.value = savedProfile.phone || "";
        if (emailInput && !emailInput.value) emailInput.value = savedProfile.email || "";
      }

      const rawDate = new Date(bookingState.selectedDate + "T00:00:00");
      const formattedDate = rawDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

      summaryDetails.innerHTML = `
        <div class="card" style="margin-bottom:0px;">
          <h4 style="color:var(--primary); margin-bottom:8px;">${escapeHtml(bookingState.serviceName)}</h4>
          <p class="service-meta" style="margin-bottom:6px;"><strong style="color:#fff">Barbero:</strong> ${escapeHtml(bookingState.barberName)}</p>
          <p class="service-meta" style="margin-bottom:6px;"><strong style="color:#fff">Fecha:</strong> ${escapeHtml(formattedDate)}</p>
          <p class="service-meta"><strong style="color:#fff">Hora:</strong> ${escapeHtml(bookingState.selectedTime)} hs (${bookingState.serviceDuration} min)</p>
          <div style="border-top:1px solid rgba(255,255,255,0.05); margin-top:12px; padding-top:12px; display:flex; justify-content:space-between;">
            <strong>Total a Pagar:</strong>
            <strong style="color:var(--primary); font-size:1.1rem;">$${formatPrice(bookingState.servicePrice)}</strong>
          </div>
        </div>
      `;
    }
  }

  function resetBookingWizard() {
    bookingState.serviceId = null;
    bookingState.serviceName = "";
    bookingState.servicePrice = 0;
    bookingState.serviceDuration = 30;
    bookingState.barberId = null;
    bookingState.barberName = "";
    bookingState.selectedDate = "";
    bookingState.selectedTime = "";

    steps.forEach((step) => {
      document.getElementById(step.pane).classList.remove("active");
      document.getElementById(step.indicator).classList.remove("active", "completed");
    });

    currentStepIndex = 0;
    document.getElementById("btn-to-step2").setAttribute("disabled", "true");
    document.getElementById("btn-to-step3").setAttribute("disabled", "true");
    document.getElementById("btn-to-step4").setAttribute("disabled", "true");

    if (formClient) formClient.reset();

    goToStep(0);
  }

  document.getElementById("btn-to-step2").addEventListener("click", () => goToStep(1));
  document.getElementById("btn-back-to-step1").addEventListener("click", () => goToStep(0));

  document.getElementById("btn-to-step3").addEventListener("click", () => goToStep(2));
  document.getElementById("btn-back-to-step2").addEventListener("click", () => goToStep(1));

  document.getElementById("btn-to-step4").addEventListener("click", () => goToStep(3));
  document.getElementById("btn-back-to-step3").addEventListener("click", () => goToStep(2));

  document.getElementById("btn-reset-booking").addEventListener("click", () => {
    resetBookingWizard();
  });

  steps.forEach((step, index) => {
    const indicator = document.getElementById(step.indicator);
    if (indicator) {
      indicator.addEventListener("click", () => {
        if (index < currentStepIndex || indicator.classList.contains("completed")) {
          goToStep(index);
        }
      });
      indicator.style.cursor = "pointer";
    }
  });

  // --- 5. Envío de Cita a Supabase ---
  if (formClient) {
    formClient.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btnSubmit = formClient.querySelector("button[type='submit']");
      const originalHtml = btnSubmit.innerHTML;
      btnSubmit.setAttribute("disabled", "true");
      btnSubmit.textContent = "Registrando turno...";

      const name = document.getElementById("client-name").value.trim();
      const phone = document.getElementById("client-phone").value.trim();
      const email = document.getElementById("client-email").value.trim() || null;

      try {
        // Revalidar disponibilidad justo antes de insertar para evitar solapamientos
        const latestBusy = await fetchBusyIntervals(bookingState.barberId, bookingState.selectedDate);
        const slotStart = timeToMinutes(bookingState.selectedTime);
        const slotEnd = slotStart + (bookingState.serviceDuration || 30);
        if (latestBusy.some((b) => slotStart < b.end && slotEnd > b.start)) {
          await showAlert("Ese horario acaba de ser reservado por otra persona. Por favor elige otra hora.", "Horario No Disponible", "alert-triangle");
          goToStep(2);
          return;
        }

        const clientToken = generateClientToken();
        const basePayload = {
          client_name: name,
          client_phone: phone,
          client_email: email,
          barber_id: bookingState.barberId,
          service_id: bookingState.serviceId,
          appointment_date: bookingState.selectedDate,
          appointment_time: bookingState.selectedTime + ":00",
          status: "pending"
        };

        let { data, error } = await supabase
          .from("appointments")
          .insert([{
            ...basePayload,
            client_token: clientToken,
            price_at_booking: bookingState.servicePrice
          }])
          .select();

        // Fallback si el esquema remoto aún no tiene client_token / price_at_booking
        if (error && error.message && (error.message.includes("client_token") || error.message.includes("price_at_booking"))) {
          const retry = await supabase
            .from("appointments")
            .insert([basePayload])
            .select();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          if (error.code === "23505" || (error.message && error.message.toLowerCase().includes("duplicate"))) {
            await showAlert("Ese horario acaba de ser ocupado. Por favor elige otro horario.", "Horario Ocupado", "alert-triangle");
            goToStep(2);
            return;
          }
          throw error;
        }

        const insertedRow = data && data[0] ? data[0] : null;
        saveMyAppointmentLocal({
          id: insertedRow ? insertedRow.id : Date.now(),
          client_token: clientToken,
          serviceName: bookingState.serviceName,
          servicePrice: Number(bookingState.servicePrice) || 0,
          serviceDuration: bookingState.serviceDuration || 30,
          barberName: bookingState.barberName,
          appointment_date: bookingState.selectedDate,
          appointment_time: bookingState.selectedTime + ":00",
          status: "pending",
          createdAt: new Date().toISOString()
        });
        saveClientProfile({ name, phone, email: email || "" });
        updateHomeAppointmentsBadge();

        const rawDate = new Date(bookingState.selectedDate + "T00:00:00");
        const formattedDate = rawDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

        confirmationDetails.innerHTML = `
          <div class="card-glass" style="border-color:var(--warning); text-align:center;">
            <div style="width:50px; height:50px; border-radius:50%; background:rgba(245,158,11,0.15); display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px;">
              <i data-lucide="clock" style="stroke:var(--warning); width:30px; height:30px;"></i>
            </div>
            <h3 style="color:var(--warning); margin-bottom:8px;">¡Turno Solicitado!</h3>
            <p class="service-meta" style="margin-bottom:16px;">Tu cita ha sido registrada. El barbero te confirmará si se acepta la reserva.</p>
            <div style="text-align:left; border-top:1px solid rgba(255,255,255,0.05); padding-top:16px; display:flex; flex-direction:column; gap:8px;">
              <p class="service-meta"><strong style="color:#fff">Cliente:</strong> ${escapeHtml(name)}</p>
              <p class="service-meta"><strong style="color:#fff">Servicio:</strong> ${escapeHtml(bookingState.serviceName)}</p>
              <p class="service-meta"><strong style="color:#fff">Barbero:</strong> ${escapeHtml(bookingState.barberName)}</p>
              <p class="service-meta"><strong style="color:#fff">Fecha:</strong> ${escapeHtml(formattedDate)}</p>
              <p class="service-meta"><strong style="color:#fff">Hora:</strong> ${escapeHtml(bookingState.selectedTime)} hs</p>
              <p class="service-meta"><strong style="color:#fff">Estado:</strong> <span class="appointment-status-tag status-pending">Por Confirmar</span></p>
            </div>
          </div>
        `;

        const btnWa = document.getElementById("btn-whatsapp-confirm");
        if (btnWa && window.shopWhatsappNumber && window.shopWhatsappNumber.trim() !== "") {
          const cleanPhone = window.shopWhatsappNumber.replace(/\D/g, "");
          const appointmentId = data && data[0] ? String(data[0].id).substring(0, 8).toUpperCase() : "";
          const msg = `¡Hola! Acabo de solicitar una cita en Los Ángeles Barber.

Detalles de la cita:
• Referencia: #${appointmentId}
• Cliente: ${name}
• Servicio: ${bookingState.serviceName}
• Barbero: ${bookingState.barberName}
• Fecha: ${formattedDate}
• Hora: ${bookingState.selectedTime} hs
• Estado: Pendiente de Confirmación

Por favor confirmen mi turno. ¡Muchas gracias!`;
          btnWa.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
          btnWa.style.display = "flex";
        } else if (btnWa) {
          btnWa.style.display = "none";
        }

        if (window.lucide) window.lucide.createIcons();
        goToStep(4);
      } catch (err) {
        console.error("Error insertando reserva:", err.message);
        await showAlert("Ocurrió un error al agendar tu cita: " + err.message, "Error al Agendar", "alert-triangle");
      } finally {
        btnSubmit.removeAttribute("disabled");
        btnSubmit.innerHTML = originalHtml;
      }
    });
  }

  // --- Lógica de Galería Lightbox ---
  let galleryImages = [];
  const lightbox = document.getElementById("gallery-lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");
  const lightboxPrev = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");
  let currentLightboxIndex = 0;

  function initLightboxEvents() {
    if (!lightbox) return;
    lightboxClose.addEventListener("click", () => { lightbox.style.display = "none"; });

    lightboxPrev.addEventListener("click", () => {
      if (galleryImages.length === 0) return;
      currentLightboxIndex = (currentLightboxIndex - 1 + galleryImages.length) % galleryImages.length;
      lightboxImg.src = galleryImages[currentLightboxIndex].src;
    });

    lightboxNext.addEventListener("click", () => {
      if (galleryImages.length === 0) return;
      currentLightboxIndex = (currentLightboxIndex + 1) % galleryImages.length;
      lightboxImg.src = galleryImages[currentLightboxIndex].src;
    });
  }

  window.refreshGalleryLightbox = function () {
    if (!lightbox) return;
    const container = document.getElementById("dyn-gallery-container");
    if (!container) return;

    galleryImages = Array.from(container.querySelectorAll("img"));
    galleryImages.forEach((img, index) => {
      img.style.cursor = "pointer";
      const newImg = img.cloneNode(true);
      img.parentNode.replaceChild(newImg, img);

      newImg.addEventListener("click", () => {
        currentLightboxIndex = index;
        lightboxImg.src = galleryImages[currentLightboxIndex].src;
        lightbox.style.display = "flex";
      });
    });

    galleryImages = Array.from(container.querySelectorAll("img"));
  };

  initLightboxEvents();
  window.refreshGalleryLightbox();

  // --- 6. Historial "Mis Citas" (localStorage + RPC por client_token) ---
  function generateClientToken() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `tok_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }

  function readMyAppointments() {
    try {
      const raw = localStorage.getItem(MY_APPOINTMENTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeMyAppointments(items) {
    try {
      localStorage.setItem(MY_APPOINTMENTS_KEY, JSON.stringify(items));
    } catch (_) {}
  }

  function saveMyAppointmentLocal(entry) {
    const list = readMyAppointments();
    list.unshift(entry);
    writeMyAppointments(list);
  }

  function readSavedClientProfile() {
    try {
      const raw = localStorage.getItem(CLIENT_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveClientProfile(profile) {
    try {
      localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(profile));
    } catch (_) {}
  }

  function updateHomeAppointmentsBadge() {
    const badge = document.getElementById("home-active-appointments-badge");
    if (!badge) return;
    const activeCount = readMyAppointments().filter(
      (a) => a.status === "pending" || a.status === "scheduled"
    ).length;
    if (activeCount > 0) {
      badge.textContent = `(${activeCount})`;
      badge.style.display = "inline";
    } else {
      badge.textContent = "";
      badge.style.display = "none";
    }
  }

  async function syncMyAppointmentsWithServer() {
    const localList = readMyAppointments();
    const tokens = localList.map((item) => item.client_token).filter(Boolean);
    if (tokens.length === 0 || typeof supabase.rpc !== "function") {
      return localList;
    }

    try {
      const { data: remoteRows, error } = await supabase.rpc("get_my_appointments", {
        p_tokens: tokens
      });
      if (error || !Array.isArray(remoteRows)) return localList;

      // Mapear resultados por id o coincidencia de fecha/hora si hubiera múltiples
      const byId = new Map();
      remoteRows.forEach((row) => byId.set(String(row.id), row));

      const merged = localList.map((localItem) => {
        const remote = byId.get(String(localItem.id));
        if (!remote) return localItem;
        return {
          ...localItem,
          id: remote.id,
          status: remote.status,
          serviceName: remote.service_name || localItem.serviceName,
          servicePrice: remote.price != null ? Number(remote.price) : localItem.servicePrice,
          serviceDuration: remote.duration_minutes != null ? Number(remote.duration_minutes) : localItem.serviceDuration,
          barberName: remote.barber_name || localItem.barberName,
          appointment_date: remote.appointment_date || localItem.appointment_date,
          appointment_time: remote.appointment_time || localItem.appointment_time
        };
      });

      writeMyAppointments(merged);
      updateHomeAppointmentsBadge();
      return merged;
    } catch (err) {
      console.warn("No se pudo sincronizar Mis Citas:", err.message);
      return localList;
    }
  }

  const MY_STATUS_META = {
    pending: { text: "Por Confirmar", cls: "status-pending" },
    scheduled: { text: "Confirmado", cls: "status-scheduled" },
    completed: { text: "Completado", cls: "status-completed" },
    cancelled: { text: "Cancelado", cls: "status-cancelled" }
  };

  function renderMyAppointments(list) {
    const container = document.getElementById("my-appointments-list");
    const statCount = document.getElementById("my-appointments-count");
    const statSpent = document.getElementById("my-appointments-spent");
    const pendingCard = document.getElementById("my-appointments-pending-card");
    const pendingTotalEl = document.getElementById("my-appointments-pending-total");
    const btnClear = document.getElementById("btn-clear-my-appointments");

    if (!container || !statCount || !statSpent) return;

    const sorted = list.slice().sort((a, b) => {
      const keyA = `${a.appointment_date || ""}T${a.appointment_time || ""}`;
      const keyB = `${b.appointment_date || ""}T${b.appointment_time || ""}`;
      return keyA < keyB ? 1 : keyA > keyB ? -1 : 0;
    });

    let spentTotal = 0;
    let pendingTotal = 0;
    sorted.forEach((item) => {
      const price = Number(item.servicePrice) || 0;
      if (item.status === "completed") {
        spentTotal += price;
      } else if (item.status === "pending" || item.status === "scheduled") {
        pendingTotal += price;
      }
    });

    statCount.textContent = sorted.length;
    statSpent.textContent = `$${formatPrice(spentTotal)}`;

    if (pendingCard && pendingTotalEl) {
      if (pendingTotal > 0) {
        pendingTotalEl.textContent = `$${formatPrice(pendingTotal)}`;
        pendingCard.style.display = "flex";
      } else {
        pendingCard.style.display = "none";
      }
    }

    if (btnClear) {
      btnClear.style.display = sorted.length > 0 ? "flex" : "none";
    }

    if (sorted.length === 0) {
      container.innerHTML = "<p class='text-muted' style='text-align:center; padding: 24px 0;'>Aún no tienes citas registradas en este dispositivo.</p>";
      return;
    }

    container.innerHTML = "";
    sorted.forEach((item) => {
      const meta = MY_STATUS_META[item.status] || MY_STATUS_META.pending;
      const rawDate = new Date((item.appointment_date || getLocalDateStr()) + "T00:00:00");
      const formattedDate = rawDate.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short"
      });
      const timeStr = (item.appointment_time || "00:00").slice(0, 5);
      const price = Number(item.servicePrice) || 0;

      let waButtonHtml = "";
      if ((item.status === "pending" || item.status === "scheduled") && window.shopWhatsappNumber) {
        const cleanPhone = window.shopWhatsappNumber.replace(/\D/g, "");
        if (cleanPhone) {
          const msg = `Hola, te escribo sobre mi cita #${item.id} (${item.serviceName} con ${item.barberName} el ${formattedDate} a las ${timeStr} hs).`;
          const waHref = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
          waButtonHtml = `
            <a href="${escapeHtml(waHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-small"
              style="margin-top: 10px; background: rgba(37, 211, 102, 0.15); color: #25D366; border: 1px solid rgba(37, 211, 102, 0.35); text-decoration: none; justify-content: center;">
              <i data-lucide="message-circle" style="width:15px; height:15px;"></i> Consultar por WhatsApp
            </a>
          `;
        }
      }

      const card = document.createElement("div");
      card.className = `appointment-list-item ${escapeHtml(item.status || "pending")}`;
      card.innerHTML = `
        <div class="appointment-header">
          <span class="appointment-time-tag">${escapeHtml(formattedDate)} • ${escapeHtml(timeStr)} hs</span>
          <span class="appointment-status-tag ${meta.cls}">${meta.text}</span>
        </div>
        <div class="appointment-details">
          <p><strong>Servicio:</strong> ${escapeHtml(item.serviceName)} (${Number(item.serviceDuration) || 30} min)</p>
          <p><strong>Barbero:</strong> ${escapeHtml(item.barberName)}</p>
          <p><strong>Valor:</strong> <span style="color:var(--primary); font-weight:600;">$${formatPrice(price)}</span></p>
        </div>
        ${waButtonHtml}
      `;
      container.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function loadMyAppointments() {
    const localList = readMyAppointments();
    renderMyAppointments(localList);
    const synced = await syncMyAppointmentsWithServer();
    renderMyAppointments(synced);
  }

  const btnRefreshMyApps = document.getElementById("btn-refresh-my-appointments");
  if (btnRefreshMyApps) {
    btnRefreshMyApps.addEventListener("click", async () => {
      btnRefreshMyApps.setAttribute("disabled", "true");
      await loadMyAppointments();
      btnRefreshMyApps.removeAttribute("disabled");
    });
  }

  const btnClearMyApps = document.getElementById("btn-clear-my-appointments");
  if (btnClearMyApps) {
    btnClearMyApps.addEventListener("click", async () => {
      if (!await showConfirm("¿Borrar el historial guardado en este dispositivo? (No cancela citas en la barbería).", "Limpiar Historial", "trash-2")) return;
      writeMyAppointments([]);
      updateHomeAppointmentsBadge();
      renderMyAppointments([]);
    });
  }

  // --- Inicialización de la Aplicación con cargador de pantalla (loader) ---
  async function initApp() {
    try {
      await loadHomeSettings();
      updateHomeAppointmentsBadge();
      const promises = [loadTeam()];
      if (window.location.hash === "#booking") {
        promises.push(loadServices());
      } else if (window.location.hash === "#my-appointments") {
        promises.push(loadMyAppointments());
      } else if (readMyAppointments().length > 0) {
        promises.push(syncMyAppointmentsWithServer());
      }
      await Promise.all(promises);
    } catch (err) {
      console.error("Error en la inicialización:", err);
    } finally {
      if (typeof window.hidePageLoader === "function") {
        window.hidePageLoader();
      }
    }
  }

  initApp();
});
