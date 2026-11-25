import { useState, type FormEvent } from 'react';
import { AlertTriangle, Database, Plus, Search, Trash2 } from 'lucide-react';
import type { EnrichedPantryItem, PantryCategory } from '../types/pantry';

interface InventoryTabProps {
  items: EnrichedPantryItem[];
  storageMode: 'supabase' | 'local-json' | 'demo-memory';
  onAddManualItem: (payload: {
    produto: string;
    categoria: PantryCategory;
    diasRestantes: number;
  }) => void;
  onShiftItemDate: (id: number, deltaDays: number) => void;
  onToggleConsumed: (id: number) => void;
  onDeleteItem: (id: number) => void;
}

const CATEGORIES: PantryCategory[] = [
  'Suplemento',
  'Laticínios',
  'Grãos & Cereais',
  'Hortifruti',
  'Mercearia',
  'Geral',
];

const STATUS_FILTERS = ['Todos', 'Em estoque', 'Alerta <= 5d', 'Consumido', 'Vencido'] as const;
type FilterOption = (typeof STATUS_FILTERS)[number];

export function InventoryTab({
  items,
  storageMode,
  onAddManualItem,
  onShiftItemDate,
  onToggleConsumed,
  onDeleteItem,
}: InventoryTabProps) {
  const [newItemName, setNewItemName] = useState('');
  const [newItemCat, setNewItemCat] = useState<PantryCategory>('Mercearia');
  const [newItemDays, setNewItemDays] = useState(4);
  const [filterStatus, setFilterStatus] = useState<FilterOption>('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    onAddManualItem({
      produto: trimmed,
      categoria: newItemCat,
      diasRestantes: newItemDays,
    });
    setNewItemName('');
  };

  const filteredItems = items.filter((item) => {
    const matchesQuery =
      !searchQuery.trim() ||
      item.produto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.categoria.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(item.id).includes(searchQuery.trim());

    if (!matchesQuery) return false;
    if (filterStatus === 'Todos') return true;
    if (filterStatus === 'Alerta <= 5d') {
      return (
        item.computedStatus === 'Em estoque' &&
        item.diasRestantes >= 0 &&
        item.diasRestantes <= 5
      );
    }
    return item.computedStatus === filterStatus;
  });

  const storageBadgeText =
    storageMode === 'supabase'
      ? 'Supabase PostgreSQL (Live)'
      : storageMode === 'local-json'
      ? 'Backend JSON Persistente (Fallback)'
      : 'Memória Local (Offline Demo)';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <span className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Database className="w-4 h-4" />
                Tabela public.despensa (RF04)
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                {storageBadgeText}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              Persistência Relacional e Simulador de Janela de Vencimento
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Todos os produtos confirmados no chat são persistidos aqui. Use os botões{' '}
              <strong className="text-amber-300">-5d / +5d</strong> para simular a aproximação do
              vencimento e validar o gatilho de receitas da meia-noite (RF06).
            </p>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome do produto, categoria ou ID..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    filterStatus === st
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-emerald-400" />
            Inserir Registro Direto (POST /api/pantry)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">
                Nome do Produto / Suplemento
              </label>
              <input
                type="text"
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Ex: Creatina Monohidratada / Leite de Amêndoas"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Categoria</label>
              <select
                value={newItemCat}
                onChange={(e) => setNewItemCat(e.target.value as PantryCategory)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Vence em quantos dias?
              </label>
              <input
                type="number"
                value={newItemDays}
                onChange={(e) => setNewItemDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
          >
            Gravar na Despensa
          </button>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">ID</th>
                <th className="py-3.5 px-4">Produto</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Validade</th>
                <th className="py-3.5 px-4">Janela de Segurança</th>
                <th className="py-3.5 px-4">Status (RF04)</th>
                <th className="py-3.5 px-4 text-right">Simular Datas / Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Nenhum item encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isCritical =
                    item.computedStatus === 'Em estoque' &&
                    item.diasRestantes >= 0 &&
                    item.diasRestantes <= 5;
                  const isExpired = item.computedStatus === 'Vencido';
                  const isConsumed = item.computedStatus === 'Consumido';

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono text-slate-400">#{item.id}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {item.produto}
                        <span className="block text-[10px] font-normal text-slate-500">
                          OCR: {item.confianca_ocr} • Cad: {item.data_cadastro}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                          {item.categoria}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                        {item.data_validade}
                      </td>
                      <td className="py-3.5 px-4">
                        {isConsumed ? (
                          <span className="text-slate-500">—</span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold">
                            Vencido há {Math.abs(item.diasRestantes)}d
                          </span>
                        ) : isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            Vence em {item.diasRestantes}d (Gatilho IA)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                            Seguro ({item.diasRestantes}d)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-md font-semibold text-[11px] ${
                            item.computedStatus === 'Em estoque'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : item.computedStatus === 'Consumido'
                              ? 'bg-sky-500/10 text-sky-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {item.computedStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onShiftItemDate(item.id, -5)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-[11px] cursor-pointer"
                            title="Aproximar vencimento em 5 dias"
                          >
                            -5d
                          </button>
                          <button
                            onClick={() => onShiftItemDate(item.id, 5)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono text-[11px] cursor-pointer"
                            title="Adiar vencimento em 5 dias"
                          >
                            +5d
                          </button>
                          <button
                            onClick={() => onToggleConsumed(item.id)}
                            className="px-2.5 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[11px] font-medium cursor-pointer"
                          >
                            {item.status === 'Consumido' ? 'Reativar' : 'Consumir'}
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            title="Excluir registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
