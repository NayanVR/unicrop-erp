<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Bill of Materials — Unicrop Biochem</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: { DEFAULT: '#15803d', light: '#dcfce7', dark: '#14532d' }
                    }
                }
            }
        }
    </script>
    <style>
        .modal-enter { animation: modalIn .18s ease-out; }
        @keyframes modalIn { from { opacity:0; transform:scale(.96) translateY(8px); } to { opacity:1; transform:none; } }
        .ing-dropdown:empty { display:none; }
        input[type=number]::-webkit-inner-spin-button { opacity: .5; }
        .table-row-hover:hover { background: #f0fdf4; }
        .skeleton { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    </style>
</head>
<body class="bg-gray-100 min-h-screen font-sans text-gray-900">

{{-- Toast --}}
<div id="toast" class="fixed top-4 right-4 z-[200] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 hidden max-w-sm"></div>

{{-- ═══ HEADER ═══ --}}
<header class="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
            <span class="text-green-700 font-bold text-lg hidden sm:inline">🌾 Unicrop Biochem</span>
            <span class="text-gray-300 hidden sm:inline">|</span>
            <span class="font-semibold text-gray-800">Bill of Materials</span>
        </div>
        <div class="flex items-center gap-3 text-sm">
            <span class="text-gray-500 hidden md:inline">{{ auth()->user()->name }}</span>
            <a href="/dashboard" class="text-green-700 hover:text-green-900 font-medium flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                Dashboard
            </a>
            <a href="/inventory" class="text-gray-500 hover:text-gray-700">Inventory</a>
        </div>
    </div>
</header>

{{-- ═══ MAIN ═══ --}}
<main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">

    {{-- Page title + New button --}}
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">BOM Recipes</h1>
            <p class="text-sm text-gray-500 mt-0.5">Define raw material requirements and batch costs for each product.</p>
        </div>
        <button onclick="openCreate()"
            class="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm whitespace-nowrap">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
            New Recipe
        </button>
    </div>

    {{-- BOM List Card --}}
    <div class="bg-white rounded-xl shadow-sm border border-gray-200">

        {{-- Search bar --}}
        <div class="p-4 border-b border-gray-100">
            <div class="relative max-w-xs">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input id="searchInput" type="text" placeholder="Search recipes…"
                    class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    oninput="renderList()">
            </div>
        </div>

        {{-- Table --}}
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="border-b border-gray-100 bg-gray-50">
                        <th class="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipe Name</th>
                        <th class="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Yield / Batch</th>
                        <th class="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch Cost</th>
                        <th class="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost / Unit</th>
                        <th class="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ingredients</th>
                        <th class="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pr-5">Actions</th>
                    </tr>
                </thead>
                <tbody id="bomTableBody">
                    <tr><td colspan="6" class="py-12 text-center">
                        <div class="skeleton h-4 w-48 rounded mx-auto mb-2"></div>
                        <div class="skeleton h-4 w-64 rounded mx-auto"></div>
                    </td></tr>
                </tbody>
            </table>
        </div>

        <div id="listFooter" class="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 hidden"></div>
    </div>
</main>

{{-- ═══════════════════════════════════════════════════════════════ --}}
{{-- DETAIL MODAL                                                    --}}
{{-- ═══════════════════════════════════════════════════════════════ --}}
<div id="detailModal"
    class="fixed inset-0 bg-black/50 z-40 hidden flex items-start justify-center p-4 overflow-y-auto"
    onclick="if(event.target===this) hideModal('detailModal')">
    <div class="modal-enter bg-white rounded-xl shadow-2xl w-full max-w-2xl mt-8 mb-8">
        <div id="detailContent"></div>
    </div>
</div>

{{-- ═══════════════════════════════════════════════════════════════ --}}
{{-- FORM MODAL (Create / Edit)                                      --}}
{{-- ═══════════════════════════════════════════════════════════════ --}}
<div id="formModal"
    class="fixed inset-0 bg-black/50 z-50 hidden flex items-start justify-center p-4 overflow-y-auto"
    onclick="if(event.target===this) hideModal('formModal')">
    <div class="modal-enter bg-white rounded-xl shadow-2xl w-full max-w-4xl mt-6 mb-8">

        <div class="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 id="formModalTitle" class="text-lg font-bold text-gray-900">New BOM Recipe</h2>
            <button onclick="hideModal('formModal')" class="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>

        <div class="p-5">
            {{-- Row 1: Name + Yield --}}
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div class="sm:col-span-2">
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Product Name <span class="text-red-500">*</span></label>
                    <input id="formName" type="text" placeholder="e.g. Humic Acid 12% Liquid"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Batch Yield <span class="text-red-500">*</span></label>
                    <div class="flex gap-2">
                        <input id="formYieldQty" type="number" placeholder="100" min="0.001" step="any"
                            class="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            oninput="calcTotal()">
                        <select id="formYieldUnit"
                            class="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            onchange="calcTotal()">
                            <option value="ltr">ltr</option>
                            <option value="kg">kg</option>
                            <option value="gm">gm</option>
                            <option value="pcs">pcs</option>
                            <option value="ml">ml</option>
                        </select>
                    </div>
                </div>
            </div>

            {{-- Notes --}}
            <div class="mb-4">
                <label class="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea id="formNotes" rows="2" placeholder="Manufacturing notes, safety instructions…"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
            </div>

            {{-- Ingredients header --}}
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-bold text-gray-700">Ingredients</h3>
                <span class="text-xs text-gray-400">Type ingredient name to search inventory</span>
            </div>

            {{-- Ingredients table --}}
            <div class="border border-gray-200 rounded-lg overflow-hidden mb-4">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="py-2 px-3 text-left text-xs font-semibold text-gray-500 w-48 sm:w-auto">Ingredient Name</th>
                            <th class="py-2 px-3 text-right text-xs font-semibold text-gray-500 w-20">Qty</th>
                            <th class="py-2 px-3 text-left text-xs font-semibold text-gray-500 w-16">Unit</th>
                            <th class="py-2 px-3 text-right text-xs font-semibold text-gray-500 w-28">₹ Cost/Unit</th>
                            <th class="py-2 px-3 text-right text-xs font-semibold text-gray-500 w-24">= Total</th>
                            <th class="py-2 px-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody id="ingredientRows"></tbody>
                </table>
            </div>

            <button type="button" onclick="addIngredientRow({})"
                class="flex items-center gap-1.5 text-green-700 hover:text-green-900 text-sm font-medium mb-5 px-2 py-1 rounded hover:bg-green-50 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                Add Ingredient
            </button>

            {{-- Live cost summary --}}
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-5">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <div class="text-xs text-gray-500 font-medium mb-1">Batch Total Cost</div>
                        <div id="formTotalCost" class="text-2xl font-bold text-green-700">₹0.00</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 font-medium mb-1">Cost per Unit</div>
                        <div id="formCostPerUnit" class="text-2xl font-bold text-gray-800">—</div>
                    </div>
                </div>
            </div>

            {{-- Form actions --}}
            <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onclick="hideModal('formModal')"
                    class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button id="saveBtn" onclick="submitForm()"
                    class="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    Save Recipe
                </button>
            </div>
        </div>
    </div>
</div>

{{-- ═══════════════════════════════════════════════════════════════ --}}
{{-- PRODUCTION RUN MODAL                                           --}}
{{-- ═══════════════════════════════════════════════════════════════ --}}
<div id="runModal"
    class="fixed inset-0 bg-black/50 z-[60] hidden flex items-center justify-center p-4"
    onclick="if(event.target===this) hideModal('runModal')">
    <div class="modal-enter bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div class="p-6">
            <h3 class="text-lg font-bold mb-1">▶ Start Production</h3>
            <p id="runBomMeta" class="text-sm text-gray-500 mb-4"></p>

            <div class="mb-4">
                <label class="block text-xs font-semibold text-gray-600 mb-1">Number of Batches <span class="text-red-500">*</span></label>
                <input id="runBatchCount" type="number" min="0.001" step="0.001" value="1"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <p class="text-xs text-gray-400 mt-1">Linked inventory items will be deducted accordingly.</p>
            </div>
            <div class="mb-5">
                <label class="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
                <textarea id="runNotes" rows="2" placeholder="e.g. Order batch for May dispatch"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"></textarea>
            </div>
            <div class="flex gap-3 justify-end">
                <button onclick="hideModal('runModal')"
                    class="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button id="runBtn" onclick="submitRun()"
                    class="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
                    ▶ Run Production
                </button>
            </div>
        </div>
    </div>
</div>

{{-- ═══════════════════════════════════════════════════════════════ --}}
{{-- JAVASCRIPT                                                      --}}
{{-- ═══════════════════════════════════════════════════════════════ --}}
<script>
'use strict';

/* ── State ───────────────────────────────────────────────────── */
let allBoms      = [];
let editingBomId = null;  // null = create, string = edit
let currentRunId = null;

/* ── Helpers ─────────────────────────────────────────────────── */
const CSRF = () => document.querySelector('meta[name="csrf-token"]').content;

function fmt(n) {
    return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt4(n) {
    return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(s)));
    return d.innerHTML;
}

async function apiFetch(url, opts = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': CSRF(),
        'Accept': 'application/json',
        ...(opts.headers || {}),
    };
    const res = await fetch(url, { ...opts, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = json.message || (json.errors ? Object.values(json.errors).flat().join(' ') : `HTTP ${res.status}`);
        throw new Error(msg);
    }
    return json;
}

function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = [
        'fixed top-4 right-4 z-[200] px-4 py-3 rounded-lg shadow-lg text-sm font-medium',
        'transition-all duration-300 max-w-sm',
        type === 'success'
            ? 'bg-green-600 text-white'
            : type === 'warning'
            ? 'bg-amber-500 text-white'
            : 'bg-red-600 text-white',
    ].join(' ');
    el.classList.remove('hidden', 'opacity-0');
    clearTimeout(window._toastT);
    window._toastT = setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => { el.classList.add('hidden'); el.style.opacity = ''; }, 300);
    }, 3500);
}

function showModal(id) {
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    el.querySelector(':scope > div')?.classList.add('modal-enter');
    document.body.style.overflow = 'hidden';
}
function hideModal(id) {
    document.getElementById(id).classList.add('hidden');
    if (!document.querySelector('[id$="Modal"]:not(.hidden)')) {
        document.body.style.overflow = '';
    }
}

/* ── Load & Render List ──────────────────────────────────────── */
async function loadBoms() {
    try {
        allBoms = await apiFetch('/api/v1/bom');
        renderList();
    } catch (e) {
        document.getElementById('bomTableBody').innerHTML =
            `<tr><td colspan="6" class="py-8 text-center text-red-500">Failed to load: ${esc(e.message)}</td></tr>`;
    }
}

function renderList() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    const filtered = allBoms.filter(b => !q || b.name.toLowerCase().includes(q));
    const tbody = document.getElementById('bomTableBody');
    const footer = document.getElementById('listFooter');

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="py-12 text-center text-gray-400">
                <div class="text-3xl mb-2">🧪</div>
                <div class="font-medium">${q ? 'No recipes match your search.' : 'No BOM recipes yet.'}</div>
                ${!q ? '<div class="text-sm mt-1">Click <strong>New Recipe</strong> to add your first one.</div>' : ''}
            </td></tr>`;
        footer.classList.add('hidden');
        return;
    }

    tbody.innerHTML = filtered.map(bom => `
        <tr class="table-row-hover border-b border-gray-100 cursor-pointer" onclick="showDetail('${esc(bom.id)}')">
            <td class="py-3 px-4">
                <div class="font-semibold text-green-700 hover:text-green-900">${esc(bom.name)}</div>
                <div class="text-xs text-gray-400 font-mono">${esc(bom.id)}</div>
            </td>
            <td class="py-3 px-4 text-gray-600">${esc(bom.yield_qty)} ${esc(bom.yield_unit)}</td>
            <td class="py-3 px-4 text-right font-semibold text-gray-900">₹${fmt(bom.total_cost)}</td>
            <td class="py-3 px-4 text-right text-gray-600">₹${fmt4(bom.cost_per_unit)}<span class="text-gray-400">/${esc(bom.yield_unit)}</span></td>
            <td class="py-3 px-4 text-right text-gray-500">${(bom.ingredients || []).length}</td>
            <td class="py-3 px-4 text-right pr-4" onclick="event.stopPropagation()">
                <div class="flex items-center justify-end gap-1">
                    <button onclick="openEdit('${esc(bom.id)}')"
                        class="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors">
                        Edit
                    </button>
                    <button onclick="duplicateBom('${esc(bom.id)}')"
                        class="px-2.5 py-1 text-xs font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors">
                        Copy
                    </button>
                    <button onclick="deleteBom('${esc(bom.id)}','${esc(bom.name).replace(/'/g,"\\'")}')">
                        <svg class="w-4 h-4 text-red-400 hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    footer.textContent = `Showing ${filtered.length} of ${allBoms.length} recipe${allBoms.length !== 1 ? 's' : ''}`;
    footer.classList.remove('hidden');
}

/* ── Detail View ─────────────────────────────────────────────── */
function showDetail(id) {
    const bom = allBoms.find(b => b.id === id);
    if (!bom) return;

    const ingredients = bom.ingredients || [];
    const rows = ingredients.map((ing, i) => `
        <tr class="${i % 2 === 0 ? '' : 'bg-gray-50'} border-b border-gray-100">
            <td class="py-2.5 px-4 font-medium">${esc(ing.name)}</td>
            <td class="py-2.5 px-4 text-right">${esc(ing.qty)}</td>
            <td class="py-2.5 px-4 text-gray-500">${esc(ing.unit)}</td>
            <td class="py-2.5 px-4 text-right">₹${fmt(ing.cost)}</td>
            <td class="py-2.5 px-4 text-right font-semibold">₹${fmt((ing.qty||0)*(ing.cost||0))}</td>
        </tr>
    `).join('');

    document.getElementById('detailContent').innerHTML = `
        <div class="p-6">
            <div class="flex items-start justify-between mb-5">
                <div>
                    <h2 class="text-xl font-bold text-gray-900">${esc(bom.name)}</h2>
                    <span class="inline-block mt-1 text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">${esc(bom.id)}</span>
                </div>
                <button onclick="hideModal('detailModal')"
                    class="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors ml-4 flex-shrink-0">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <div class="grid grid-cols-3 gap-3 mb-5">
                <div class="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                    <div class="text-xs text-gray-500 mb-1">Yield / Batch</div>
                    <div class="text-lg font-bold text-green-700">${esc(bom.yield_qty)} ${esc(bom.yield_unit)}</div>
                </div>
                <div class="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                    <div class="text-xs text-gray-500 mb-1">Batch Cost</div>
                    <div class="text-lg font-bold text-blue-700">₹${fmt(bom.total_cost)}</div>
                </div>
                <div class="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                    <div class="text-xs text-gray-500 mb-1">Cost / ${esc(bom.yield_unit)}</div>
                    <div class="text-lg font-bold text-purple-700">₹${fmt4(bom.cost_per_unit)}</div>
                </div>
            </div>

            <h3 class="text-sm font-bold text-gray-700 mb-2">Ingredients Breakdown</h3>
            <div class="border border-gray-200 rounded-lg overflow-hidden mb-4">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="py-2 px-4 text-left text-xs font-semibold text-gray-500">Ingredient</th>
                            <th class="py-2 px-4 text-right text-xs font-semibold text-gray-500">Qty</th>
                            <th class="py-2 px-4 text-left text-xs font-semibold text-gray-500">Unit</th>
                            <th class="py-2 px-4 text-right text-xs font-semibold text-gray-500">Cost/Unit</th>
                            <th class="py-2 px-4 text-right text-xs font-semibold text-gray-500">Total</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="5" class="py-4 text-center text-gray-400">No ingredients</td></tr>'}</tbody>
                    <tfoot class="bg-gray-50 border-t border-gray-200">
                        <tr>
                            <td colspan="4" class="py-2.5 px-4 text-sm font-bold text-gray-700">Total Batch Cost</td>
                            <td class="py-2.5 px-4 text-right font-bold text-green-700">₹${fmt(bom.total_cost)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            ${bom.notes ? `<div class="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-4">
                <span class="font-semibold">📌 Notes:</span> ${esc(bom.notes)}
            </div>` : ''}

            <div class="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                <button onclick="hideModal('detailModal'); openEdit('${esc(bom.id)}')"
                    class="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    ✏️ Edit
                </button>
                <button onclick="hideModal('detailModal'); duplicateBom('${esc(bom.id)}')"
                    class="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    ⧉ Duplicate
                </button>
                <button onclick="hideModal('detailModal'); deleteBom('${esc(bom.id)}','${esc(bom.name).replace(/'/g,"\\'")}')">
                    <span class="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                        🗑 Delete
                    </span>
                </button>
                <button onclick="hideModal('detailModal'); openRunModal('${esc(bom.id)}')"
                    class="ml-auto flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                    ▶ Start Production
                </button>
            </div>
        </div>
    `;

    showModal('detailModal');
}

/* ── Form: Create / Edit ─────────────────────────────────────── */
function openCreate() {
    editingBomId = null;
    document.getElementById('formModalTitle').textContent = 'New BOM Recipe';
    document.getElementById('formName').value       = '';
    document.getElementById('formYieldQty').value   = '';
    document.getElementById('formYieldUnit').value  = 'ltr';
    document.getElementById('formNotes').value      = '';
    document.getElementById('ingredientRows').innerHTML = '';
    addIngredientRow({});
    calcTotal();
    showModal('formModal');
    setTimeout(() => document.getElementById('formName').focus(), 100);
}

function openEdit(id) {
    const bom = allBoms.find(b => b.id === id);
    if (!bom) return;

    editingBomId = id;
    document.getElementById('formModalTitle').textContent = `Edit: ${bom.name}`;
    document.getElementById('formName').value      = bom.name;
    document.getElementById('formYieldQty').value  = bom.yield_qty;
    document.getElementById('formYieldUnit').value = bom.yield_unit;
    document.getElementById('formNotes').value     = bom.notes || '';

    document.getElementById('ingredientRows').innerHTML = '';
    const ings = bom.ingredients || [];
    ings.forEach(ing => addIngredientRow(ing));
    if (ings.length === 0) addIngredientRow({});

    calcTotal();
    showModal('formModal');
}

async function submitForm() {
    const name     = document.getElementById('formName').value.trim();
    const yieldQty = parseFloat(document.getElementById('formYieldQty').value);
    const yieldUnit= document.getElementById('formYieldUnit').value;
    const notes    = document.getElementById('formNotes').value.trim();

    if (!name)              { toast('Product name is required.', 'error'); return; }
    if (!yieldQty || yieldQty <= 0) { toast('Yield quantity must be greater than 0.', 'error'); return; }

    const ingredients = [];
    let hasError = false;

    document.querySelectorAll('#ingredientRows .ingredient-row').forEach(row => {
        const ingName = row.querySelector('.ing-name').value.trim();
        const qty     = parseFloat(row.querySelector('.ing-qty').value);
        const unit    = row.querySelector('.ing-unit').value.trim();
        const cost    = parseFloat(row.querySelector('.ing-cost').value) || 0;
        const invId   = row.querySelector('.ing-inv-id').value.trim();

        if (!ingName) { hasError = true; return; }

        ingredients.push({
            invId: invId || null,
            name:  ingName,
            qty:   isNaN(qty) ? 0 : qty,
            unit:  unit || 'kg',
            cost:  cost,
        });
    });

    if (hasError || ingredients.length === 0) {
        toast('All ingredient rows must have a name. Empty rows: add or remove them.', 'error');
        return;
    }

    const payload = { name, yield_qty: yieldQty, yield_unit: yieldUnit, ingredients, notes: notes || null };
    const btn = document.getElementById('saveBtn');

    try {
        btn.disabled = true;
        btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Saving…';

        if (editingBomId) {
            const updated = await apiFetch(`/api/v1/bom/${editingBomId}`, {
                method: 'PUT', body: JSON.stringify(payload),
            });
            const idx = allBoms.findIndex(b => b.id === editingBomId);
            if (idx !== -1) allBoms[idx] = updated;
            toast('Recipe updated successfully.');
        } else {
            const created = await apiFetch('/api/v1/bom', {
                method: 'POST', body: JSON.stringify(payload),
            });
            allBoms.push(created);
            toast('Recipe created successfully.');
        }

        hideModal('formModal');
        renderList();
    } catch (e) {
        toast(e.message || 'Save failed.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Save Recipe';
    }
}

/* ── Ingredients ─────────────────────────────────────────────── */
let _rowCounter = 0;

function addIngredientRow(ing = {}) {
    const rowId = 'ir_' + (++_rowCounter);
    const tr = document.createElement('tr');
    tr.className = 'ingredient-row border-b border-gray-100';
    tr.dataset.rowId = rowId;
    tr.innerHTML = `
        <td class="py-2 px-3">
            <div class="relative">
                <input type="text" class="ing-name w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    value="${esc(ing.name || '')}" placeholder="Search ingredient…"
                    oninput="debounceSearch(this,'${rowId}')" autocomplete="off" spellcheck="false">
                <div class="ing-dropdown absolute top-full left-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg w-full max-h-40 overflow-y-auto hidden mt-0.5"></div>
            </div>
            <input type="hidden" class="ing-inv-id" value="${esc(ing.invId || '')}">
        </td>
        <td class="py-2 px-2">
            <input type="number" class="ing-qty w-20 border border-gray-200 rounded-md px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-400"
                value="${ing.qty != null ? ing.qty : ''}" min="0" step="any" placeholder="0"
                oninput="calcTotal()">
        </td>
        <td class="py-2 px-2">
            <input type="text" class="ing-unit w-14 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                value="${esc(ing.unit || '')}" placeholder="kg">
        </td>
        <td class="py-2 px-2">
            <input type="number" class="ing-cost w-24 border border-gray-200 rounded-md px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-400"
                value="${ing.cost != null ? ing.cost : ''}" min="0" step="0.01" placeholder="0.00"
                oninput="calcTotal()">
        </td>
        <td class="py-2 px-3 text-right">
            <span class="ing-line text-sm font-semibold text-gray-600">₹0.00</span>
        </td>
        <td class="py-2 px-2 text-center">
            <button type="button" onclick="removeIngredientRow(this)"
                class="text-gray-300 hover:text-red-500 transition-colors p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </td>`;
    document.getElementById('ingredientRows').appendChild(tr);
    calcTotal();
}

function removeIngredientRow(btn) {
    btn.closest('tr').remove();
    calcTotal();
}

function calcTotal() {
    let total = 0;
    document.querySelectorAll('#ingredientRows .ingredient-row').forEach(row => {
        const qty  = parseFloat(row.querySelector('.ing-qty').value)  || 0;
        const cost = parseFloat(row.querySelector('.ing-cost').value) || 0;
        const line = qty * cost;
        total += line;
        row.querySelector('.ing-line').textContent = '₹' + fmt(line);
    });

    const yieldQty  = parseFloat(document.getElementById('formYieldQty').value)  || 0;
    const yieldUnit = document.getElementById('formYieldUnit').value;

    document.getElementById('formTotalCost').textContent  = '₹' + fmt(total);
    document.getElementById('formCostPerUnit').textContent = yieldQty > 0
        ? '₹' + fmt4(total / yieldQty) + ' / ' + yieldUnit
        : '—';
}

/* ── Ingredient Search / Autocomplete ────────────────────────── */
const _searchTimers = {};

function debounceSearch(input, rowId) {
    calcTotal();
    clearTimeout(_searchTimers[rowId]);
    _searchTimers[rowId] = setTimeout(() => fetchInventorySearch(input, rowId), 280);
}

async function fetchInventorySearch(input, rowId) {
    const q = input.value.trim();
    const dropdown = input.nextElementSibling;

    if (q.length < 1) { dropdown.classList.add('hidden'); return; }

    try {
        const results = await apiFetch(`/api/v1/inventory/search?q=${encodeURIComponent(q)}`);

        if (results.length === 0) {
            dropdown.innerHTML = `<div class="px-3 py-2.5 text-xs text-amber-700 bg-amber-50 flex items-center gap-1.5">
                <span>⚠️</span><span>Not found in inventory — enter details manually</span>
            </div>`;
        } else {
            dropdown.innerHTML = '';
            results.forEach(item => {
                const el = document.createElement('div');
                el.className = 'px-3 py-2 text-sm hover:bg-green-50 cursor-pointer flex items-center justify-between border-b border-gray-50 last:border-0';
                el.innerHTML = `<span class="font-medium">${esc(item.name)}</span>
                    <span class="text-xs text-gray-400 ml-2">${esc(item.unit)} · ₹${fmt(item.cost)}</span>`;
                el.addEventListener('click', () => {
                    selectInventoryItem(rowId, item.id, item.name, item.unit, item.cost);
                });
                dropdown.appendChild(el);
            });
        }
        dropdown.classList.remove('hidden');
    } catch (_) { /* silent */ }
}

function selectInventoryItem(rowId, id, name, unit, cost) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    if (!row) return;
    row.querySelector('.ing-name').value   = name;
    row.querySelector('.ing-inv-id').value = id;
    row.querySelector('.ing-unit').value   = unit;
    row.querySelector('.ing-cost').value   = cost;
    row.querySelector('.ing-dropdown').classList.add('hidden');
    calcTotal();
}

// Close all dropdowns on outside click
document.addEventListener('click', e => {
    document.querySelectorAll('.ing-dropdown').forEach(d => {
        if (!d.parentElement.contains(e.target)) d.classList.add('hidden');
    });
});

/* ── Delete / Duplicate ──────────────────────────────────────── */
async function deleteBom(id, name) {
    if (!confirm(`Delete BOM recipe "${name}"?\n\nThis cannot be undone.`)) return;

    try {
        await apiFetch(`/api/v1/bom/${encodeURIComponent(id)}`, { method: 'DELETE' });
        allBoms = allBoms.filter(b => b.id !== id);
        renderList();
        toast('Recipe deleted.');
    } catch (e) {
        toast(e.message || 'Delete failed.', 'error');
    }
}

async function duplicateBom(id) {
    try {
        const copy = await apiFetch(`/api/v1/bom/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
        allBoms.push(copy);
        renderList();
        toast(`Duplicated as "${copy.name}" (${copy.id}).`);
    } catch (e) {
        toast(e.message || 'Duplicate failed.', 'error');
    }
}

/* ── Production Run ──────────────────────────────────────────── */
function openRunModal(id) {
    const bom = allBoms.find(b => b.id === id);
    if (!bom) return;
    currentRunId = id;
    document.getElementById('runBomMeta').textContent =
        `${bom.name} — ${bom.yield_qty} ${bom.yield_unit} per batch`;
    document.getElementById('runBatchCount').value = '1';
    document.getElementById('runNotes').value = '';
    showModal('runModal');
}

async function submitRun() {
    const batchCount = parseFloat(document.getElementById('runBatchCount').value);
    if (!batchCount || batchCount <= 0) {
        toast('Enter a valid batch count (> 0).', 'error');
        return;
    }

    const notes = document.getElementById('runNotes').value.trim();
    const btn = document.getElementById('runBtn');

    try {
        btn.disabled = true;
        btn.textContent = '⏳ Running…';

        const result = await apiFetch(`/api/v1/bom/${encodeURIComponent(currentRunId)}/run`, {
            method: 'POST',
            body: JSON.stringify({ batch_count: batchCount, notes: notes || null }),
        });

        hideModal('runModal');
        toast(result.message || 'Production run completed.', 'success');
    } catch (e) {
        toast(e.message || 'Production run failed.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '▶ Run Production';
    }
}

/* ── Init ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', loadBoms);
</script>

</body>
</html>
