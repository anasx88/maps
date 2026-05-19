const markerColors = {
  hospital: "#dc2626",
  fieldHospital: "#ec4899",
  center: "#0f766e",
  urgent: "#f59e0b",
  booth: "#7c3aed",
  unit: "#2563eb",
  helipad: "#eab308",
  default: "#64748b",
};

const state = {
  sites: [],
  filteredSites: [],
  markers: [],
  selectedSiteId: null,
};

const map = L.map("map", {
  zoomControl: false,
  maxBoundsViscosity: 0.85,
}).setView([21.3891, 39.8579], 11);

L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);

const elements = {
  searchInput: document.getElementById("searchInput"),
  regionFilter: document.getElementById("regionFilter"),
  typeFilter: document.getElementById("typeFilter"),
  operatorFilter: document.getElementById("operatorFilter"),
  resultSummary: document.getElementById("resultSummary"),
  siteDetails: document.getElementById("siteDetails"),
  sidePanel: document.getElementById("sidePanel"),
  closePanel: document.getElementById("closePanel"),
  openMobileFilters: document.getElementById("openMobileFilters"),
  closeMobileFilters: document.getElementById("closeMobileFilters"),
  toggleMobileLegend: document.getElementById("toggleMobileLegend"),
  infoModal: document.getElementById("infoModal"),
  closeInfoModal: document.getElementById("closeInfoModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  legend: document.getElementById("legend"),
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("ar-SA");
}

function uniqueValues(key) {
  return [...new Set(state.sites.map((site) => site[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "ar")
  );
}

function getFilterConfigs() {
  return [
    { field: "region", element: elements.regionFilter, allLabel: "كل المناطق" },
    { field: "facilityType", element: elements.typeFilter, allLabel: "كل الأنواع" },
    { field: "operator", element: elements.operatorFilter, allLabel: "كل الجهات" },
  ];
}

function getCurrentFilters() {
  return {
    search: normalizeText(elements.searchInput.value),
    region: elements.regionFilter.value,
    facilityType: elements.typeFilter.value,
    operator: elements.operatorFilter.value,
  };
}

function siteMatchesFilters(site, filters, ignoredField = "") {
  const matchesSearch = !filters.search || normalizeText(site.name).includes(filters.search);
  const matchesRegion = ignoredField === "region" || !filters.region || site.region === filters.region;
  const matchesType =
    ignoredField === "facilityType" || !filters.facilityType || site.facilityType === filters.facilityType;
  const matchesOperator = ignoredField === "operator" || !filters.operator || site.operator === filters.operator;
  return matchesSearch && matchesRegion && matchesType && matchesOperator;
}

function availableValues(field, filters) {
  return [...new Set(
    state.sites
      .filter((site) => siteMatchesFilters(site, filters, field))
      .map((site) => site[field])
      .filter(Boolean)
  )].sort((a, b) => String(a).localeCompare(String(b), "ar"));
}

function fillSelect(select, values, allLabel) {
  const selectedValue = select.value;
  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = allLabel;
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.value = values.includes(selectedValue) ? selectedValue : "";
}

function updateFilterOptions(filters) {
  getFilterConfigs().forEach(({ field, element, allLabel }) => {
    fillSelect(element, availableValues(field, filters), allLabel);
  });
}

function facilityCategory(type) {
  const label = String(type || "أخرى").trim() || "أخرى";
  const value = normalizeText(type);
  if (value.includes("booth")) return { label, color: markerColors.booth };
  if (value.includes("مهبط")) return { label, color: markerColors.helipad };
  if (value.includes("رعاية عاجلة")) return { label, color: markerColors.urgent };
  if (value.includes("وحدة صحية")) return { label, color: markerColors.unit };
  if (value.includes("مركز صحي")) return { label, color: markerColors.center };
  if (value.includes("مستشفى ميداني")) return { label, color: markerColors.fieldHospital };
  if (value.includes("مستشفى")) return { label, color: markerColors.hospital };
  return { label, color: markerColors.default };
}

function facilityColor(type) {
  return facilityCategory(type).color;
}

function buildLegendItems() {
  const items = new Map();
  state.sites.forEach((site) => {
    const category = facilityCategory(site.facilityType);
    items.set(category.label, category.color);
  });

  return [...items.entries()]
    .map(([label, color]) => ({ label, color }))
    .sort((a, b) => a.label.localeCompare(b.label, "ar"));
}

function createMarkerIcon(site) {
  const color = facilityCategory(site.facilityType).color;
  return L.divIcon({
    className: "",
    html: `<span class="site-marker" style="--marker-color:${color}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -22],
  });
}

function locationKey(site) {
  return `${Number(site.latitude).toFixed(6)},${Number(site.longitude).toFixed(6)}`;
}

function groupSitesByLocation(sites) {
  const groups = new Map();
  sites.forEach((site) => {
    const key = locationKey(site);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        latitude: site.latitude,
        longitude: site.longitude,
        sites: [],
      });
    }
    groups.get(key).sites.push(site);
  });
  return [...groups.values()];
}

function createGroupMarkerIcon(group) {
  const color = facilityCategory(group.sites[0]?.facilityType).color;
  const count = group.sites.length > 1 ? `<span class="marker-count">${group.sites.length}</span>` : "";
  return L.divIcon({
    className: "",
    html: `<span class="site-marker" style="--marker-color:${color}">${count}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -24],
  });
}

function sitesBounds(sites) {
  return L.latLngBounds(sites.map((site) => [site.latitude, site.longitude]));
}

function focusMapOnSites(sites, options = {}) {
  if (!sites.length) return;

  const bounds = sitesBounds(sites);
  if (options.lockToArea) {
    map.setMaxBounds(bounds.pad(0.22));
  }

  map.fitBounds(bounds.pad(options.pad ?? 0.04), {
    padding: options.padding ?? [20, 20],
    maxZoom: options.maxZoom ?? 14,
  });
}

function formatPerson(person) {
  if (!person || (!person.name && !person.mobile)) {
    return "غير متوفر";
  }

  const mobile = person.mobile ? String(person.mobile) : "لا يوجد رقم";
  return `${escapeHtml(person.name || "غير متوفر")}<br>${escapeHtml(mobile)}`;
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <span class="detail-label">${escapeHtml(label)}</span>
      <div class="detail-value">${value || "غير متوفر"}</div>
    </div>
  `;
}

function optionalDetailRow(label, value) {
  if (value === undefined || value === null || value === "") return "";
  return detailRow(label, escapeHtml(value));
}

function renderSiteDetails(site) {
  renderInfoWindow([site]);
}

function renderBedsDetails(site) {
  return [
    optionalDetailRow("إجمالي الأسرة", site.bedsTotal || site.beds),
    optionalDetailRow("أسرة العناية المركزة", site.bedsIcu),
    optionalDetailRow("أسرة الطوارئ", site.bedsEmergency),
    optionalDetailRow("أسرة العيادات", site.bedsClinics),
    optionalDetailRow("أسرة العمليات", site.bedsOperations),
    optionalDetailRow("أسرة العزل", site.bedsIsolation),
    optionalDetailRow("أسرة ضربات الحرارة", site.bedsHeat),
    optionalDetailRow("سعة ثلاجة الموتى", site.morgueCapacity),
    optionalDetailRow("مجال الخدمة", site.serviceScope),
    optionalDetailRow("التخصصات أو الخدمات الرئيسية", site.mainServices),
    optionalDetailRow("نطاق التغطية", site.coverageScope),
  ].join("");
}

function renderExtraFields(site) {
  return Object.entries(site.extraFields || {})
    .filter(([label]) => !String(label).includes("مصدر"))
    .filter(([label]) => String(label) !== "نوع بيانات الأسرة")
    .map(([label, value]) => detailRow(label, escapeHtml(value)))
    .join("");
}

function renderSiteCard(site) {
  const mapsUrl = escapeAttribute(site.googleMapsUrl || "#");
  return `
    <article class="modal-site-card">
      <h3>${escapeHtml(site.name || "موقع غير مسمى")}</h3>
      <div class="detail-list">
        ${detailRow("المنطقة", escapeHtml(site.region))}
        ${detailRow("نوع المنشأة", escapeHtml(site.facilityType))}
        ${detailRow("الجهة المشغلة", escapeHtml(site.operator))}
        ${renderBedsDetails(site)}
        ${detailRow("اسم المسؤول ورقم الجوال", formatPerson(site.responsible))}
        ${detailRow("اسم مستلم العهدة ورقم الجوال", formatPerson(site.custodyReceiver))}
        ${renderExtraFields(site)}
      </div>
      <a class="maps-link" href="${mapsUrl}" target="_blank" rel="noopener">فتح في Google Maps</a>
    </article>
  `;
}

function renderInfoWindow(sites) {
  if (!sites.length) return;
  elements.modalTitle.textContent =
    sites.length > 1 ? `${sites.length} مواقع في نفس المكان` : sites[0].name || "تفاصيل الموقع";
  elements.modalBody.innerHTML = sites.map(renderSiteCard).join("");
  elements.infoModal.hidden = false;
  elements.infoModal.classList.add("is-open");
}

function closeInfoWindow() {
  elements.infoModal.classList.remove("is-open");
  elements.infoModal.hidden = true;
  elements.modalBody.innerHTML = "";
}

function renderLegacySidePanel(site) {
  state.selectedSiteId = site.id;
  elements.siteDetails.classList.remove("empty-state");
  const mapsUrl = escapeAttribute(site.googleMapsUrl || "#");
  elements.siteDetails.innerHTML = `
    <h2 class="site-title">${escapeHtml(site.name || "موقع غير مسمى")}</h2>
    <div class="detail-list">
      ${detailRow("المنطقة", escapeHtml(site.region))}
      ${detailRow("نوع المنشأة", escapeHtml(site.facilityType))}
      ${detailRow("الجهة المشغلة", escapeHtml(site.operator))}
      ${renderBedsDetails(site)}
      ${detailRow("اسم المسؤول ورقم الجوال", formatPerson(site.responsible))}
      ${detailRow("اسم مستلم العهدة ورقم الجوال", formatPerson(site.custodyReceiver))}
    </div>
    <a class="maps-link" href="${mapsUrl}" target="_blank" rel="noopener">فتح في Google Maps</a>
  `;
  elements.sidePanel.classList.add("is-open");
}

function renderMarkers() {
  markerLayer.clearLayers();
  const groups = groupSitesByLocation(state.filteredSites);
  state.markers = groups.map((group) => {
    const title =
      group.sites.length > 1 ? `${group.sites.length} مواقع في نفس المكان` : group.sites[0]?.name || "";
    const marker = L.marker([group.latitude, group.longitude], {
      icon: createGroupMarkerIcon(group),
      title,
    });
    marker.bindPopup(
      group.sites.length > 1
        ? `<strong>${group.sites.length} مواقع في نفس المكان</strong>`
        : `<strong>${escapeHtml(group.sites[0]?.name || "موقع غير مسمى")}</strong><br>${escapeHtml(group.sites[0]?.facilityType || "")}`
    );
    marker.on("click", () => renderInfoWindow(group.sites));
    marker.addTo(markerLayer);
    return marker;
  });

  if (state.filteredSites.length) {
    focusMapOnSites(state.filteredSites, { maxZoom: 15 });
  }
}

function applyFilters() {
  updateFilterOptions(getCurrentFilters());

  const filters = getCurrentFilters();
  state.filteredSites = state.sites.filter((site) => siteMatchesFilters(site, filters));

  elements.resultSummary.textContent = `${state.filteredSites.length} من ${state.sites.length} موقع`;
  document.body.classList.remove("filters-open");
  renderMarkers();
}

function renderLegend() {
  elements.legend.innerHTML = buildLegendItems()
    .map(
      ({ label, color }) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${color}"></span>
          <span>${escapeHtml(label)}</span>
        </div>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function setupControls() {
  updateFilterOptions(getCurrentFilters());

  [
    elements.searchInput,
    elements.regionFilter,
    elements.typeFilter,
    elements.operatorFilter,
  ].forEach((element) => element.addEventListener("input", applyFilters));

  elements.closePanel.addEventListener("click", () => {
    state.selectedSiteId = null;
    elements.siteDetails.classList.add("empty-state");
    elements.siteDetails.textContent = "اختر موقعًا من الخريطة لعرض التفاصيل.";
    elements.sidePanel.classList.remove("is-open");
  });

  elements.closeInfoModal.addEventListener("click", closeInfoWindow);
  elements.infoModal.addEventListener("click", (event) => {
    if (event.target === elements.infoModal) closeInfoWindow();
  });

  elements.openMobileFilters.addEventListener("click", () => {
    document.body.classList.add("filters-open");
    elements.legend.classList.remove("is-open");
  });

  elements.closeMobileFilters.addEventListener("click", () => {
    document.body.classList.remove("filters-open");
  });

  elements.toggleMobileLegend.addEventListener("click", () => {
    elements.legend.classList.toggle("is-open");
    document.body.classList.remove("filters-open");
  });

  window.__mobileControlsReady = true;
}

async function loadSites() {
  try {
    if (Array.isArray(window.SITES_DATA)) {
      state.sites = window.SITES_DATA;
      state.filteredSites = [...state.sites];
    setupControls();
    renderLegend();
    applyFilters();
    focusMapOnSites(state.sites, { lockToArea: true, maxZoom: 13 });
    return;
    }

    const response = await fetch("data/sites.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.sites = await response.json();
    state.filteredSites = [...state.sites];
    setupControls();
    renderLegend();
    applyFilters();
    focusMapOnSites(state.sites, { lockToArea: true, maxZoom: 13 });
  } catch (error) {
    elements.resultSummary.textContent = "تعذر تحميل ملف البيانات";
    elements.siteDetails.classList.add("empty-state");
    elements.siteDetails.textContent = "تأكد من تشغيل الصفحة عبر خادم محلي ومن وجود data/sites.json.";
    console.error(error);
  }
}

loadSites();
