"use strict";
// Zamockowane dane (możesz rozbudować)
let tests = [
    {
        id: "suite-a",
        name: "Suite A",
        description: "Root suite A",
        children: [
            { id: "a-1", name: "Test A1", description: "Sprawdza logowanie" },
            { id: "a-2", name: "Test A2", description: "Sprawdza wylogowanie" },
        ],
    },
    {
        id: "suite-b",
        name: "Suite B",
        children: [
            {
                id: "b-1",
                name: "Nested Suite",
                children: [
                    { id: "b-1-1", name: "Deep Test", description: "Głęboki test" },
                ],
            },
        ],
    },
];
// --- playlist state ---
let playlist = [];
let playlistIndex = -1;
let playlistTimer = null;
const PLAY_INTERVAL_MS = 3000; // czas pomiędzy testami podczas odtwarzania
// --- playlist helpers (updated to support Playwright-style ids) ---
function normalizeIdToken(s) {
    // usuń prowadzący '#' lub 'pw:' jeśli ktoś dodał, oraz trim
    return s.trim().replace(/^#/, "").replace(/^pw:/i, "");
}
function parsePlaylistInput(raw) {
    return raw
        .split(/[,\n\r]+|[ \t]+/) // allow commas, newlines or whitespace separators
        .map(normalizeIdToken)
        .filter(Boolean);
}
// Bezpieczne escape dla selektorów (użyj natywnego CSS.escape gdy dostępny)
function cssEscapeForAttr(s) {
    // @ts-ignore
    if (typeof window.CSS === "object" &&
        typeof window.CSS.escape === "function") {
        // @ts-ignore
        return window.CSS.escape(s);
    }
    // prosta fallback (escapuje " oraz \ oraz zamienia spacje na \ )
    return s.replace(/(["\\\r\n\t])/g, "\\$1");
}
function matchesTokenAgainstId(token, id) {
    if (!token)
        return false;
    if (id === token)
        return true; // exact
    // jeśli token wygląda jak Playwright (z dwukropkiem z numerem linii), spróbuj endsWith
    if (/:/.test(token)) {
        if (id.endsWith(token))
            return true;
        if (id.includes(token))
            return true;
    }
    else {
        // prostsze dopasowanie: contains
        if (id.toLowerCase().includes(token.toLowerCase()))
            return true;
    }
    return false;
}
function findTestByIdFlexible(items, token) {
    // 1) exact / flexible id match
    for (const it of items) {
        if (matchesTokenAgainstId(token, it.id))
            return it;
        if (it.children) {
            const r = findTestByIdFlexible(it.children, token);
            if (r)
                return r;
        }
    }
    // 2) fallback: szukaj po nazwie (case-insensitive contains)
    for (const it of items) {
        if ((it.name || "").toLowerCase().includes(token.toLowerCase()))
            return it;
        if (it.children) {
            const r = findTestByIdFlexible(it.children, token);
            if (r)
                return r;
        }
    }
    return null;
}
function updatePlaylistStatusDisplay() {
    const el = document.getElementById("playlist-status");
    if (!el)
        return;
    const total = playlist.length;
    const idx = playlistIndex >= 0 && playlistIndex < total ? playlistIndex + 1 : 0;
    el.textContent = `${idx}/${total}`;
}
function findTestById(items, id) {
    for (const it of items) {
        if (it.id === id)
            return it;
        if (it.children) {
            const r = findTestById(it.children, id);
            if (r)
                return r;
        }
    }
    return null;
}
function expandAncestorsAndSelect(id) {
    const esc = cssEscapeForAttr(id);
    const li = document.querySelector(`li[data-id="${esc}"]`);
    if (li) {
        // rozwijaj wszystkie nadrzędne UL
        let el = li;
        while (el && el !== document.body) {
            const parentUl = el.parentElement;
            if (parentUl && parentUl.tagName === "UL") {
                parentUl.classList.remove("collapsed");
                // ustaw znak expander dla rodzica (jeśli istnieje)
                const parentLi = parentUl.parentElement;
                if (parentLi && parentLi.tagName === "LI") {
                    const exp = parentLi.querySelector(".expander");
                    if (exp)
                        exp.textContent = "−";
                }
            }
            el = parentUl?.parentElement;
        }
        // usuń zaznaczenie i dodaj do celu
        document
            .querySelectorAll(".test-name.selected")
            .forEach((n) => n.classList.remove("selected"));
        const name = li.querySelector(".test-name");
        if (name)
            name.classList.add("selected");
        // przewiń do elementu
        li.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
}
function selectTestById(token) {
    if (!token)
        return false;
    // najpierw normalne wyszukiwanie el. id (dokładne), potem elastyczne (Playwright-style), potem po name
    let t = null;
    // exact first
    t = findTestById(tests, token);
    if (!t) {
        // flexible match (handles file:line hashes etc.)
        t = findTestByIdFlexible(tests, token);
    }
    if (!t)
        return false;
    showDetails(t);
    expandAncestorsAndSelect(t.id);
    return true;
}
function stopPlaylist() {
    if (playlistTimer !== null) {
        clearInterval(playlistTimer);
        playlistTimer = null;
    }
}
function playPlaylist(startIndex = 0) {
    if (!playlist.length) {
        // spróbuj z inputa
        const input = document.getElementById("playlist-input");
        if (input)
            playlist = parsePlaylistInput(input.value || "");
        if (!playlist.length)
            return;
    }
    playlistIndex = Math.max(0, Math.min(startIndex, playlist.length - 1));
    stopPlaylist();
    // wybierz pierwszy
    const started = selectTestById(playlist[playlistIndex]);
    updatePlaylistStatusDisplay();
    if (!started) {
        // jeśli pierwszy nie odnaleziony, przejdź dalej
        advancePlaylist();
    }
    playlistTimer = window.setInterval(() => {
        advancePlaylist();
    }, PLAY_INTERVAL_MS);
}
function advancePlaylist() {
    playlistIndex++;
    if (playlistIndex >= playlist.length) {
        stopPlaylist();
        updatePlaylistStatusDisplay();
        return;
    }
    if (selectTestById(playlist[playlistIndex])) {
        updatePlaylistStatusDisplay();
    }
    else {
        // jeśli nie znaleziono - kontynuuj
        updatePlaylistStatusDisplay();
        advancePlaylist();
    }
}
function prevInPlaylist() {
    if (!playlist.length)
        return;
    playlistIndex = Math.max(0, playlistIndex - 1);
    if (selectTestById(playlist[playlistIndex]))
        updatePlaylistStatusDisplay();
}
// Replace/createTree with search-aware version and add filtering + highlight helpers
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[c]));
}
function highlightText(text, query) {
    if (!query)
        return escapeHtml(text);
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(q, "ig");
    return escapeHtml(text).replace(re, (m) => `<mark>${escapeHtml(m)}</mark>`);
}
function matchesItem(item, q) {
    if (!q)
        return true;
    const s = (item.id +
        " " +
        item.name +
        " " +
        (item.description || "")).toLowerCase();
    return s.includes(q.toLowerCase());
}
function filterTests(items, q) {
    if (!q)
        return items;
    const out = [];
    for (const it of items) {
        const filteredChildren = it.children ? filterTests(it.children, q) : [];
        if (matchesItem(it, q) || filteredChildren.length > 0) {
            const copy = {
                id: it.id,
                name: it.name,
                description: it.description,
            };
            if (filteredChildren.length > 0)
                copy.children = filteredChildren;
            out.push(copy);
        }
    }
    return out;
}
function renderTree(query = "") {
    const tree = document.getElementById("tree");
    tree.innerHTML = "";
    const filtered = filterTests(tests, query);
    if (filtered.length === 0) {
        const no = document.createElement("div");
        no.className = "no-results";
        no.textContent = "Brak wyników";
        tree.appendChild(no);
        return;
    }
    createTree(filtered, tree, query);
}
// --- nowe funkcje: ładowanie z katalogu xray / mapowanie ---
function setSourceStatus(s) {
    const el = document.getElementById("source-status");
    if (el)
        el.textContent = s;
}
function mapXrayItem(item) {
    // dopasowuje popularne pola eksportów Xray/Jira do wewnętrznego Test
    const id = item.key || item.id || item.testKey || item.issueKey || "";
    const name = item.summary || item.name || item.title || id || "unnamed";
    const description = item.description || item.fields?.description || item.details || "";
    const childrenRaw = item.tests || item.children || item.items || item.nodes || [];
    const children = Array.isArray(childrenRaw) && childrenRaw.length > 0
        ? childrenRaw.map(mapXrayItem)
        : undefined;
    const out = { id, name, description };
    if (children)
        out.children = children;
    return out;
}
async function fetchJsonMaybe(path) {
    try {
        const r = await fetch(path, { cache: "no-store" });
        if (!r.ok)
            throw new Error(`HTTP ${r.status}`);
        return await r.json();
    }
    catch (e) {
        return null;
    }
}
async function fetchXrayData() {
    // 1) spróbuj index.json w folderze xray (lista plików)
    const index = await fetchJsonMaybe("/xray/index.json");
    if (Array.isArray(index)) {
        const results = [];
        for (const fname of index) {
            const data = await fetchJsonMaybe(`/xray/${fname}`);
            if (data) {
                if (Array.isArray(data))
                    results.push(...data);
                else if (data.tests)
                    results.push(...(Array.isArray(data.tests) ? data.tests : []));
                else
                    results.push(data);
            }
        }
        if (results.length > 0) {
            return results.map(mapXrayItem);
        }
    }
    // 2) spróbuj pojedynczego pliku tests.json
    const maybe = await fetchJsonMaybe("/xray/tests.json");
    if (maybe) {
        if (Array.isArray(maybe))
            return maybe.map(mapXrayItem);
        if (maybe.tests && Array.isArray(maybe.tests))
            return maybe.tests.map(mapXrayItem);
        // jeśli obiekt pojedynczy, spróbuj znaleźć pola
        if (maybe.issues && Array.isArray(maybe.issues))
            return maybe.issues.map(mapXrayItem);
        // fallback: spróbuj zamapować obiekt jako pojedynczy test
        return [mapXrayItem(maybe)];
    }
    // nic nie znaleziono
    return null;
}
// helper: załaduj i zastosuj surowy obiekt/array Xray z File lub pamięci
function applyParsedXray(raw) {
    let arr = [];
    if (Array.isArray(raw))
        arr = raw;
    else if (raw.tests && Array.isArray(raw.tests))
        arr = raw.tests;
    else if (raw.issues && Array.isArray(raw.issues))
        arr = raw.issues;
    else
        arr = [raw];
    tests = arr.map(mapXrayItem);
    setSourceStatus("Źródło: wczytany plik Xray (lokalny)");
    renderTree();
    updatePlaylistStatusDisplay();
}
function handleXrayFileInput(file) {
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const txt = String(reader.result || "");
            const parsed = JSON.parse(txt);
            applyParsedXray(parsed);
        }
        catch (e) {
            setSourceStatus("Błąd parsowania pliku Xray");
            console.error("Xray parse error", e);
        }
    };
    reader.onerror = () => {
        setSourceStatus("Błąd odczytu pliku Xray");
    };
    reader.readAsText(file, "utf-8");
}
// modyfikacja createTree: ustawienia data-id na li i nazwie
function createTree(items, container, query = "") {
    const ul = document.createElement("ul");
    ul.className = "tree-list";
    for (const item of items) {
        const li = document.createElement("li");
        li.className = "tree-item";
        li.setAttribute("data-id", item.id); // <- added
        const hasChildren = item.children && item.children.length > 0;
        const row = document.createElement("div");
        row.className = "tree-row";
        const expander = document.createElement("button");
        expander.className = "expander";
        expander.textContent = hasChildren ? "+" : "";
        if (!hasChildren) {
            expander.disabled = true;
            expander.classList.add("no-child");
        }
        const name = document.createElement("span");
        name.className = "test-name";
        name.setAttribute("data-id", item.id); // <- added
        // set HTML with highlighted fragments if query present
        if (query) {
            name.innerHTML = highlightText(item.name, query);
        }
        else {
            name.textContent = item.name;
        }
        row.appendChild(expander);
        row.appendChild(name);
        li.appendChild(row);
        ul.appendChild(li);
        if (hasChildren) {
            // rekurencja
            createTree(item.children, li, query);
        }
    }
    container.appendChild(ul);
}
// --- stare funkcje: bez zmian ---
function countTests(t) {
    if (!t.children || t.children.length === 0)
        return 1;
    return t.children.reduce((sum, c) => sum + countTests(c), 0);
}
function showDetails(test) {
    // wypełnij pola (są stworzone w index.html)
    const idEl = document.getElementById("detail-id");
    if (idEl)
        idEl.textContent = test.id;
    const nameEl = document.getElementById("detail-name");
    if (nameEl)
        nameEl.textContent = test.name;
    const descEl = document.getElementById("detail-description");
    if (descEl)
        descEl.textContent = test.description || "Brak opisu";
    // ustaw długość (liczba leaf tests)
    const lenEl = document.getElementById("detail-length");
    if (lenEl)
        lenEl.textContent = String(countTests(test));
    // surowe JSON
    const jsonEl = document.getElementById("detail-json");
    if (jsonEl)
        jsonEl.textContent = JSON.stringify(test, null, 2);
    // pokaż meta i ukryj placeholder
    const meta = document.querySelector(".detail-meta");
    const empty = document.querySelector(".empty");
    if (meta)
        meta.style.display = "block";
    if (empty)
        empty.style.display = "none";
    // ukryj wszystkie sekcje i pokaż tylko odpowiednią
    document
        .querySelectorAll(".detail-section")
        .forEach((s) => (s.style.display = "none"));
    const toShow = document.getElementById("detail-section-" + (test.id.startsWith("suite-") ? "suite" : "test"));
    if (toShow)
        toShow.style.display = "block";
}
// --- stare funkcje: bez zmian ---
function handleTreeClick(ev) {
    const target = ev.target;
    if (!target)
        return;
    const nameEl = target.closest(".test-name");
    if (!nameEl)
        return;
    const id = nameEl.getAttribute("data-id") || undefined;
    if (!id)
        return;
    selectTestById(id);
}
function init() {
    renderTree();
    updatePlaylistStatusDisplay();
    loadSavedPanelWidth();
    attachResizer();
    // delegacja kliknięć
    const tree = document.getElementById("tree");
    if (tree) {
        tree.addEventListener("click", handleTreeClick);
    }
    // podłącz input pliku Xray
    const fileInput = document.getElementById("xray-file-input");
    if (fileInput) {
        fileInput.addEventListener("change", (ev) => {
            const f = ev.target.files?.[0] || null;
            handleXrayFileInput(f);
        });
    }
    // ...existing code for search/playlist hookup...
}
// --- stare funkcje: bez zmian ---
window.addEventListener("load", init);
// resizer behaviour: drag + keyboard, persist width in localStorage
const PANEL_WIDTH_KEY = "e2e.leftPanelWidthPx";
const MIN_LEFT_PX = 180;
const MAX_LEFT_PX = 1000;
function loadSavedPanelWidth() {
    try {
        const v = localStorage.getItem(PANEL_WIDTH_KEY);
        if (v) {
            const px = parseInt(v, 10);
            if (!isNaN(px)) {
                document.documentElement.style.setProperty("--left-width", `${px}px`);
            }
        }
    }
    catch (e) {
        // ignore
    }
}
function savePanelWidthPx(px) {
    try {
        localStorage.setItem(PANEL_WIDTH_KEY, String(px));
    }
    catch (e) {
        // ignore
    }
}
function attachResizer() {
    const resizer = document.getElementById("resizer");
    const left = document.querySelector(".left-panel");
    if (!resizer || !left)
        return;
    let dragging = false;
    let startX = 0;
    let startWidth = 0;
    const onMove = (clientX) => {
        const delta = clientX - startX;
        const newWidth = Math.max(MIN_LEFT_PX, Math.min(MAX_LEFT_PX, startWidth + delta));
        // set as pixels to avoid layout jumps
        document.documentElement.style.setProperty("--left-width", `${newWidth}px`);
        savePanelWidthPx(newWidth);
    };
    const mouseMove = (ev) => {
        if (!dragging)
            return;
        onMove(ev.clientX);
        ev.preventDefault();
    };
    const mouseUp = () => {
        if (!dragging)
            return;
        dragging = false;
        document.removeEventListener("mousemove", mouseMove);
        document.removeEventListener("mouseup", mouseUp);
        resizer.classList.remove("active");
    };
    resizer.addEventListener("mousedown", (ev) => {
        dragging = true;
        startX = ev.clientX;
        startWidth = left.getBoundingClientRect().width;
        document.addEventListener("mousemove", mouseMove);
        document.addEventListener("mouseup", mouseUp);
        resizer.classList.add("active");
        ev.preventDefault();
    });
    // touch support
    resizer.addEventListener("touchstart", (ev) => {
        dragging = true;
        startX = ev.touches[0].clientX;
        startWidth = left.getBoundingClientRect().width;
        const touchMove = (tev) => {
            onMove(tev.touches[0].clientX);
            tev.preventDefault();
        };
        const touchEnd = () => {
            dragging = false;
            document.removeEventListener("touchmove", touchMove);
            document.removeEventListener("touchend", touchEnd);
        };
        document.addEventListener("touchmove", touchMove, { passive: false });
        document.addEventListener("touchend", touchEnd);
    }, { passive: true });
    // keyboard: when resizer is focused, allow arrow keys
    resizer.addEventListener("keydown", (ev) => {
        const step = ev.shiftKey ? 20 : 8;
        if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
            const cur = left.getBoundingClientRect().width;
            const newWidth = Math.max(MIN_LEFT_PX, Math.min(MAX_LEFT_PX, cur + (ev.key === "ArrowLeft" ? -step : step)));
            document.documentElement.style.setProperty("--left-width", `${newWidth}px`);
            savePanelWidthPx(newWidth);
            ev.preventDefault();
        }
    });
}
