"use strict";
// Zamockowane dane (możesz rozbudować)
const tests = [
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
function createTree(items, container, query = "") {
    const ul = document.createElement("ul");
    ul.className = "tree-list";
    for (const item of items) {
        const li = document.createElement("li");
        li.className = "tree-item";
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
        // set HTML with highlighted fragments if query present
        if (query) {
            name.innerHTML = highlightText(item.name, query);
        }
        else {
            name.textContent = item.name;
        }
        name.title = item.description || "";
        name.addEventListener("click", () => {
            showDetails(item);
            document
                .querySelectorAll(".test-name.selected")
                .forEach((n) => n.classList.remove("selected"));
            name.classList.add("selected");
        });
        expander.addEventListener("click", () => {
            if (!hasChildren)
                return;
            const childUl = li.querySelector("ul");
            if (!childUl)
                return;
            const isCollapsed = childUl.classList.toggle("collapsed");
            expander.textContent = isCollapsed ? "+" : "−";
        });
        row.appendChild(expander);
        row.appendChild(name);
        li.appendChild(row);
        if (hasChildren) {
            createTree(item.children, li, query);
            const childUl = li.querySelector("ul");
            if (childUl) {
                childUl.classList.add("collapsed");
            }
        }
        ul.appendChild(li);
    }
    container.appendChild(ul);
}
function showDetails(t) {
    const details = document.getElementById("details");
    details.innerHTML = "";
    const title = document.createElement("h2");
    title.textContent = t.name;
    details.appendChild(title);
    const desc = document.createElement("p");
    desc.textContent = t.description || "Brak opisu";
    details.appendChild(desc);
    const pre = document.createElement("pre");
    pre.className = "json";
    pre.textContent = JSON.stringify(t, null, 2);
    details.appendChild(pre);
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
document.addEventListener("DOMContentLoaded", () => {
    const tree = document.getElementById("tree");
    tree.innerHTML = "";
    // initial render
    renderTree();
    const input = document.getElementById("search-input");
    if (input) {
        input.addEventListener("input", () => {
            const q = (input.value || "").trim().slice(0, 20);
            renderTree(q);
        });
    }
});
