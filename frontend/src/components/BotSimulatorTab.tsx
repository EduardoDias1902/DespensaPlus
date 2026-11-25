import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  ArrowUpRight,
  Bot,
  Camera,
  CheckCheck,
  CheckCircle2,
  Edit3,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Utensils,
  X,
} from 'lucide-react';
import { PRESET_SAMPLES } from '../data/samples';
import type {
  ChatMessage,
  PendingConfirmationState,
  PresetSample,
} from '../types/pantry';
import { addDaysToToday, normalizeBrazilianDate } from '../utils/date';

interface BotSimulatorTabProps {
  chatMessages: ChatMessage[];
  isProcessingOCR: boolean;
  pendingConfirmation: PendingConfirmationState | null;
  geminiConfigured: boolean;
  geminiModel: string;
  onSimulateSamplePhoto: (sample: PresetSample) => void;
  onRealImageUpload: (file: File) => void;
  onConfirmSave: (editedProduct: string, editedDate: string) => void;
  onDiscardPending: () => void;
  onSendCommand: (text: string) => void;
}

function FormattedMessageText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
      {lines.map((line, lineIdx) => {
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
        return (
          <p key={lineIdx} className="min-h-[0.75rem]">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={pIdx} className="font-bold text-white">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <code
                    key={pIdx}
                    className="px-1.5 py-0.5 rounded bg-slate-900/90 text-emerald-300 font-mono text-[11px]"
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              }
              if (part.startsWith('_') && part.endsWith('_')) {
                return (
                  <em key={pIdx} className="italic text-slate-300">
                    {part.slice(1, -1)}
                  </em>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function BotSimulatorTab({
  chatMessages,
  isProcessingOCR,
  pendingConfirmation,
  geminiConfigured,
  geminiModel,
  onSimulateSamplePhoto,
  onRealImageUpload,
  onConfirmSave,
  onDiscardPending,
  onSendCommand,
}: BotSimulatorTabProps) {
  const [chatInput, setChatInput] = useState('');
  const [editingPending, setEditingPending] = useState(false);
  const [customProductInput, setCustomProductInput] = useState('');
  const [customDateInput, setCustomDateInput] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isProcessingOCR]);

  useEffect(() => {
    if (pendingConfirmation) {
      setCustomProductInput(pendingConfirmation.extracted.produto);
      setCustomDateInput(pendingConfirmation.extracted.data_validade);
      setEditingPending(false);
      setDateError(null);
    }
  }, [pendingConfirmation]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onRealImageUpload(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onRealImageUpload(file);
    }
  };

  const handleSubmitChat = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendCommand(trimmed);
    setChatInput('');
  };

  const handleConfirmClick = () => {
    if (!pendingConfirmation) return;
    const rawDate = editingPending
      ? customDateInput
      : pendingConfirmation.extracted.data_validade;
    const normalized = normalizeBrazilianDate(rawDate);
    if (!normalized) {
      setDateError('Data inválida. Use DD/MM/AAAA (ex: 20/11/2026) ou MM/AAAA (ex: 12/2026).');
      return;
    }
    const finalProduct =
      editingPending && customProductInput.trim()
        ? customProductInput.trim()
        : pendingConfirmation.extracted.produto;
    setDateError(null);
    onConfirmSave(finalProduct, normalized);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* COLUNA ESQUERDA: CAPTURA DE FOTOS E AMOSTRAS (LAYOUT LIMPO) */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Camera className="w-4 h-4" />
              Entrada sem Atrito (RF01 & RF02)
            </span>
            <span className="text-[11px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
              {geminiConfigured ? `Gemini Vision` : 'Gemini OCR'}
            </span>
          </div>
          <h2 className="text-base font-bold text-white mb-1">
            Enviar Foto de Alimento ou Embalagem
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Ao chegar do mercado, envie ou arraste uma foto de <strong>qualquer alimento ou embalagem</strong>. O <strong>Gemini Vision</strong> identifica o produto e lê (ou estima) a validade sem digitação manual.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessingOCR && fileInputRef.current?.click()}
            className={`w-full py-5 px-4 rounded-xl border-2 border-dashed transition cursor-pointer mb-5 flex flex-col items-center justify-center gap-2 text-center ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/15 scale-[1.01]'
                : 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10'
            }`}
          >
            <Upload className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-300 font-semibold text-xs sm:text-sm">
              Clique ou arraste uma foto de alimento aqui
            </span>
            <span className="text-[11px] text-slate-400">
              JPG, PNG, WEBP ou HEIC (otimizado automaticamente)
            </span>
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-300">
              Ou clique em uma embalagem de teste (Simulação Instantânea):
            </p>
            {PRESET_SAMPLES.map((sample) => {
              const simulatedDate = addDaysToToday(sample.diasOffset);
              return (
                <button
                  key={sample.id}
                  onClick={() => onSimulateSamplePhoto(sample)}
                  disabled={isProcessingOCR}
                  className={`w-full text-left p-3 rounded-xl bg-gradient-to-r ${sample.cor} border hover:scale-[1.01] active:scale-[0.99] transition flex items-center justify-between gap-3 cursor-pointer disabled:opacity-50`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl select-none">{sample.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-white truncate">
                        {sample.produto}
                      </p>
                      <p className="text-[11px] text-slate-300 truncate">
                        Carimbo: <span className="font-mono text-emerald-300">VAL {simulatedDate}</span> •{' '}
                        {sample.categoria}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-900/80 text-emerald-300 border border-slate-700">
                    Enviar Foto
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Por que Visão Computacional ao invés de Código de Barras?</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            O código de barras (EAN-13) identifica apenas o produto genérico e não contém lote nem validade (além de não existir em frutas/verduras). O Gemini analisa tanto o alimento quanto o carimbo na mesma foto.
          </p>
        </div>
      </div>

      {/* COLUNA DIREITA: SIMULADOR TELEGRAM / WHATSAPP */}
      <div className="lg:col-span-7 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[690px]">
        <div className="bg-slate-800/90 border-b border-slate-700/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-800 absolute bottom-0 right-0" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Assistente de Despensa Bot</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                  Webhook Ativo
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                online • Telegram/WhatsApp + Gemini Vision + Supabase
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {['/estoque', '/consumido', '/resumo'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => onSendCommand(cmd)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-mono transition cursor-pointer"
              >
                {cmd}
              </button>
            ))}
            <button
              onClick={() => onSendCommand('/alerta')}
              className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-mono transition cursor-pointer"
            >
              /alerta
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
          {chatMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isCurrentPending =
              msg.type === 'ocr_confirmation' && pendingConfirmation?.messageId === msg.id;

            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-md ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-bl-none'
                  }`}
                >
                  {msg.type === 'photo_sample' && (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 flex items-center gap-3">
                        <span className="text-3xl">{msg.sample.emoji}</span>
                        <div>
                          <p className="text-xs font-bold text-white">
                            📸 Foto: {msg.sample.produto}
                          </p>
                          <p className="text-[11px] font-mono text-emerald-200 mt-0.5">
                            Carimbo na Embalagem: VAL {msg.expDate}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-emerald-100">
                        Imagem enviada para leitura automática...
                      </p>
                    </div>
                  )}

                  {msg.type === 'photo_real' && (
                    <div className="space-y-2">
                      <img
                        src={msg.imageUrl}
                        alt="Alimento enviado"
                        className="max-h-52 rounded-xl object-cover border border-white/20 w-full"
                      />
                      <p className="text-xs text-emerald-100">📸 {msg.fileName}</p>
                    </div>
                  )}

                  {msg.type === 'text' && <FormattedMessageText text={msg.text} />}

                  {msg.type === 'ocr_confirmation' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-2">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Leitura Óptica Concluída (RF02)
                        </span>
                        <div className="flex items-center gap-1.5">
                          {msg.extracted.aiMode && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                msg.extracted.aiMode === 'gemini'
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {msg.extracted.aiMode === 'gemini'
                                ? msg.extracted.modelUsed || 'Gemini Live'
                                : 'Demo'}
                            </span>
                          )}
                          <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded">
                            {msg.extracted.confianca_ocr}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-700/80 space-y-1.5 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Produto:</span>
                          <span className="font-bold text-white text-right">
                            {msg.extracted.produto}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Categoria:</span>
                          <span className="text-slate-200">{msg.extracted.categoria}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-slate-400">Validade:</span>
                          <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
                            {msg.extracted.data_validade}
                          </span>
                        </div>
                        {msg.extracted.estado_conservacao && (
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-400">Estado Visual:</span>
                            <span className="text-emerald-300 font-medium text-right">
                              {msg.extracted.estado_conservacao}
                            </span>
                          </div>
                        )}
                        {msg.extracted.latencyMs !== undefined && (
                          <div className="flex justify-between items-center gap-2 text-[11px]">
                            <span className="text-slate-400">Latência (RNF01 &lt; 10s):</span>
                            <span className="font-mono text-emerald-300">
                              {(msg.extracted.latencyMs / 1000).toFixed(2)}s
                            </span>
                          </div>
                        )}
                        {msg.extracted.contexto_imagem && (
                          <div className="pt-2 border-t border-slate-800 space-y-1">
                            <p className="text-[11px] font-semibold text-sky-300">
                              👁️ Contexto da Imagem:
                            </p>
                            <p className="text-[11px] text-slate-200 leading-relaxed">
                              {msg.extracted.contexto_imagem}
                            </p>
                          </div>
                        )}
                        {msg.extracted.dica_conservacao && (
                          <p className="text-[11px] text-emerald-200/90 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg">
                            ❄️ <strong>Conservação:</strong> {msg.extracted.dica_conservacao}
                          </p>
                        )}
                        {msg.extracted.sugestao_uso && (
                          <p className="text-[11px] text-amber-200/90 bg-amber-500/10 px-2.5 py-1.5 rounded-lg">
                            🍽️ <strong>Ideia rápida:</strong> {msg.extracted.sugestao_uso}
                          </p>
                        )}
                        {msg.extracted.lote_ou_obs && (
                          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                            🔍 {msg.extracted.lote_ou_obs}
                          </p>
                        )}
                      </div>

                      {isCurrentPending && (
                        <div className="space-y-2 pt-1">
                          {editingPending && (
                            <div className="space-y-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-700">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  Ajustar nome do alimento
                                </label>
                                <input
                                  type="text"
                                  value={customProductInput}
                                  onChange={(e) => setCustomProductInput(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  Ajustar validade (DD/MM/AAAA ou MM/AAAA)
                                </label>
                                <input
                                  type="text"
                                  value={customDateInput}
                                  onChange={(e) => {
                                    setCustomDateInput(e.target.value);
                                    setDateError(null);
                                  }}
                                  placeholder="DD/MM/AAAA ou MM/AAAA"
                                  className="w-full bg-slate-950 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                                />
                              </div>
                              {dateError && (
                                <p className="text-[11px] text-rose-400">{dateError}</p>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={handleConfirmClick}
                              className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirmar e Salvar
                            </button>
                            <button
                              onClick={() => setEditingPending((prev) => !prev)}
                              className="py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs flex items-center gap-1 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              {editingPending ? 'Fechar Edição' : 'Ajustar'}
                            </button>
                            <button
                              onClick={onDiscardPending}
                              className="py-2 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs flex items-center gap-1 transition cursor-pointer"
                              title="Descartar leitura"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {msg.type === 'recipe_alert' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-amber-400 font-bold text-xs border-b border-slate-700 pb-2">
                        <span className="flex items-center gap-2">
                          <Utensils className="w-4 h-4" />
                          Alerta Ativo + Curadoria IA (RF07/RF08)
                        </span>
                        {msg.aiData.aiMode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-emerald-300">
                            {msg.aiData.aiMode === 'gemini' ? msg.aiData.modelUsed : 'Demo Local'}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed">
                        {msg.aiData.resumo_alerta}
                      </p>

                      <div className="space-y-2.5">
                        {msg.aiData.receitas.map((rec, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-emerald-300">
                                🍲 {idx + 1}. {rec.titulo}
                              </h4>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                                ⏱️ {rec.tempo_preparo}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {rec.ingredientes_usados.map((ing, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                >
                                  {ing}
                                </span>
                              ))}
                            </div>

                            <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside">
                              {rec.passo_a_passo.map((step, sIdx) => (
                                <li key={sIdx}>{step}</li>
                              ))}
                            </ol>

                            {rec.dica_nutricional && (
                              <p className="text-[11px] text-amber-300/90 bg-amber-500/10 px-2.5 py-1.5 rounded-lg">
                                💡 {rec.dica_nutricional}
                              </p>
                            )}

                            <div className="pt-1">
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(
                                  rec.termo_busca_link || rec.titulo
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-semibold text-emerald-400 hover:underline inline-flex items-center gap-1"
                              >
                                <span>Ver passo a passo completo na Web</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] opacity-60">
                    <span>{msg.timestamp}</span>
                    {isUser && <CheckCheck className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            );
          })}

          {isProcessingOCR && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-3 text-xs text-slate-300">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                <span>
                  Identificando alimento com <strong>{geminiModel}</strong>...
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="p-3 bg-slate-800/90 border-t border-slate-700/80 flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-emerald-400 transition cursor-pointer"
            title="Enviar foto de alimento"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitChat()}
            placeholder="Digite /estoque, /consumido 102, /resumo, /alerta..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleSubmitChat}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
