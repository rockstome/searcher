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
function createTree(items, container) {
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
        name.textContent = item.name;
        name.title = item.description || "";
        name.addEventListener("click", () => {
            showDetails(item);
            // highlight
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
            createTree(item.children, li);
            // initially collapsed
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
document.addEventListener("DOMContentLoaded", () => {
    const tree = document.getElementById("tree");
    tree.innerHTML = "";
    createTree(tests, tree);
});
