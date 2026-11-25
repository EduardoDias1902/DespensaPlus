import { useCallback, useEffect, useMemo, useState } from 'react';
import { AutomationTab } from './components/AutomationTab';
import { BotSimulatorTab } from './components/BotSimulatorTab';
import { Header } from './components/Header';
import { InventoryTab } from './components/InventoryTab';
import { PlanningHubTab } from './components/PlanningHubTab';
import { INITIAL_CRON_LOGS, INITIAL_DEMO_INVENTORY } from './data/samples';
import { apiClient } from './services/api';
import type {
  ActiveTab,
  ChatMessage,
  CronRunResult,
  CronStepLog,
  EnrichedPantryItem,
  HealthStatus,
  OcrExtractionResult,
  PantryCategory,
  PendingConfirmationState,
  PresetSample,
  WeeklySummaryReport,
} from './types/pantry';
import {
  addDaysToToday,
  calculateDaysRemaining,
  enrichPantryItem,
  nowTime,
  shiftDateString,
} from './utils/date';
import { compressImageForVision } from './utils/image';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('bot');
  const [backendOnline, setBackendOnline] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [inventory, setInventory] = useState<EnrichedPantryItem[]>(() =>
    INITIAL_DEMO_INVENTORY.map(enrichPantryItem)
  );
  const [nextDemoId, setNextDemoId] = useState(200);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'bot',
      timestamp: nowTime(),
      type: 'text',
      text: '👋 Olá! Eu sou o seu **Assistente Inteligente de Despensa**.\n\n📸 **Como usar:** Envie uma foto da embalagem mostrando a data de validade (ou clique em uma amostra ao lado) que o backend aciona o **Gemini Vision OCR** e persiste no **Supabase**!\n\n💬 **Comandos rápidos:**\n• `/estoque` — Lista seus itens ativos ordenados por vencimento\n• `/consumido <id ou nome>` — Dá baixa no item consumido\n• `/resumo` — Exibe métricas da despensa\n• `/alerta` — Dispara a curadoria de receitas da meia-noite',
    },
  ]);

  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmationState | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);

  const [isRunningCron, setIsRunningCron] = useState(false);
  const [activeCronStep, setActiveCronStep] = useState(0);
  const [lastCronResult, setLastCronResult] = useState<CronRunResult | null>(null);
  const [cronLogs, setCronLogs] = useState<CronStepLog[]>(INITIAL_CRON_LOGS);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryReport | null>(null);

  const loadBackendData = useCallback(async () => {
    try {
      const [healthRes, pantryRes, logsRes] = await Promise.all([
        apiClient.getHealth(),
        apiClient.listPantry(),
        apiClient.getCronLogs(),
      ]);
      setHealth(healthRes);
      setBackendOnline(true);
      setInventory(pantryRes.items);
      if (logsRes.logs.length > 0) setCronLogs(logsRes.logs);
      if (logsRes.lastRun) setLastCronResult(logsRes.lastRun);
    } catch {
      setBackendOnline(false);
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    void loadBackendData();
  }, [loadBackendData]);

  const activeItems = useMemo(
    () => inventory.filter((i) => i.computedStatus === 'Em estoque'),
    [inventory]
  );
  const expiringSoonItems = useMemo(
    () => activeItems.filter((i) => i.diasRestantes >= 0 && i.diasRestantes <= 5),
    [activeItems]
  );
  const expiredItems = useMemo(
    () => inventory.filter((i) => i.computedStatus === 'Vencido'),
    [inventory]
  );

  // =========================================================================
  // OCR & CAPTURA (RF01, RF02, RF03)
  // =========================================================================
  const handleSimulateSamplePhoto = (sample: PresetSample) => {
    const expDate = addDaysToToday(sample.diasOffset);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        timestamp: nowTime(),
        type: 'photo_sample',
        sample,
        expDate,
      },
    ]);
    setIsProcessingOCR(true);

    setTimeout(() => {
      const extracted: OcrExtractionResult = {
        produto: sample.produto,
        categoria: sample.categoria,
        data_validade: expDate,
        confianca_ocr: sample.confianca_ocr,
        lote_ou_obs: sample.lote_ou_obs,
        aiMode: 'fallback',
        latencyMs: 950,
      };
      const botMessageId = `bot-sample-${Date.now()}`;
      setPendingConfirmation({ messageId: botMessageId, extracted });
      setIsProcessingOCR(false);
      setChatMessages((prev) => [
        ...prev,
        {
          id: botMessageId,
          sender: 'bot',
          timestamp: nowTime(),
          type: 'ocr_confirmation',
          extracted,
        },
      ]);
    }, 950);
  };

  const handleConfigureGemini = async (apiKey: string, model: string) => {
    await apiClient.configureGemini(apiKey, model);
    await loadBackendData();
  };

  const handleRealImageUpload = (file: File) => {
    setLastUploadedFile(file);
    void (async () => {
      setIsProcessingOCR(true);
      try {
        const { file: optimizedFile, previewUrl } = await compressImageForVision(file);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `user-img-${Date.now()}`,
            sender: 'user',
            timestamp: nowTime(),
            type: 'photo_real',
            imageUrl: previewUrl,
            fileName: file.name,
          },
        ]);

        let extracted: OcrExtractionResult;
        if (backendOnline) {
          const response = await apiClient.analyzeImage(optimizedFile);
          extracted = response.extracted;
        } else {
          extracted = {
            produto: 'Backend offline',
            categoria: 'Mercearia',
            data_validade: addDaysToToday(4),
            confianca_ocr: 'Offline',
            lote_ou_obs: 'Inicie o backend e configure a GEMINI_API_KEY para reconhecimento real.',
            aiMode: 'fallback',
            latencyMs: 300,
            requiresApiKey: true,
          };
        }

        const botMessageId = `bot-ocr-${Date.now()}`;
        if (!extracted.requiresApiKey) {
          setPendingConfirmation({ messageId: botMessageId, extracted });
        } else {
          setPendingConfirmation(null);
        }
        setChatMessages((prev) => [
          ...prev,
          {
            id: botMessageId,
            sender: 'bot',
            timestamp: nowTime(),
            type: 'ocr_confirmation',
            extracted,
          },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha na leitura OCR.';
        setChatMessages((prev) => [
          ...prev,
          {
            id: `bot-ocr-err-${Date.now()}`,
            sender: 'bot',
            timestamp: nowTime(),
            type: 'text',
            text: `⚠️ Não foi possível concluir a identificação na API: ${msg}`,
          },
        ]);
      } finally {
        setIsProcessingOCR(false);
      }
    })();
  };

  const handleConfirmSave = async (editedProduct: string, editedDate: string) => {
    if (!pendingConfirmation) return;
    const { extracted } = pendingConfirmation;

    try {
      let saved: EnrichedPantryItem;
      if (backendOnline) {
        const res = await apiClient.createPantryItem({
          produto: editedProduct,
          categoria: extracted.categoria,
          data_validade: editedDate,
          confianca_ocr: extracted.confianca_ocr,
          lote_ou_obs: extracted.lote_ou_obs,
        });
        saved = res.item;
        setInventory((prev) => [saved, ...prev]);
      } else {
        const id = nextDemoId;
        setNextDemoId((n) => n + 1);
        saved = enrichPantryItem({
          id,
          user_id: 'usr_telegram_99412',
          produto: editedProduct,
          categoria: extracted.categoria,
          data_cadastro: addDaysToToday(0),
          data_validade: editedDate,
          status: calculateDaysRemaining(editedDate) < 0 ? 'Vencido' : 'Em estoque',
          confianca_ocr: extracted.confianca_ocr,
          lote_ou_obs: extracted.lote_ou_obs,
        });
        setInventory((prev) => [saved, ...prev]);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `bot-saved-${Date.now()}`,
          sender: 'bot',
          timestamp: nowTime(),
          type: 'text',
          text: `✅ **Registro salvo com sucesso!**\n\n📦 **Item:** ${saved.produto} (ID #${saved.id})\n📅 **Validade:** ${saved.data_validade} (${
            saved.diasRestantes >= 0 ? `faltam ${saved.diasRestantes} dia(s)` : 'vencido'
          })\n🔔 **Monitoramento:** O Cron Job da meia-noite avisará você 5 dias antes do vencimento com receitas personalizadas.`,
        },
      ]);
      setPendingConfirmation(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar registro.';
      setChatMessages((prev) => [
        ...prev,
        {
          id: `bot-save-err-${Date.now()}`,
          sender: 'bot',
          timestamp: nowTime(),
          type: 'text',
          text: `❌ Falha ao salvar no banco: ${msg}`,
        },
      ]);
    }
  };

  const handleDiscardPending = () => {
    setPendingConfirmation(null);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `bot-discard-${Date.now()}`,
        sender: 'bot',
        timestamp: nowTime(),
        type: 'text',
        text: '🗑️ Leitura descartada. Envie uma nova foto quando quiser!',
      },
    ]);
  };

  // =========================================================================
  // CRON JOB 00:00 & CURADORIA IA (RF06, RF07, RF08)
  // =========================================================================
  const triggerMidnightCronJob = async (switchToChat = false) => {
    if (isRunningCron) return;
    setIsRunningCron(true);
    setActiveCronStep(1);
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      await wait(350);
      setActiveCronStep(2);
      await wait(350);
      setActiveCronStep(3);
      await wait(350);
      setActiveCronStep(4);

      if (backendOnline) {
        const result = await apiClient.runCron('web_dashboard');
        setActiveCronStep(5);
        await wait(300);

        setLastCronResult(result);
        if (result.logs && result.logs.length > 0) {
          setCronLogs(result.logs);
        }

        setChatMessages((prev) => [
          ...prev,
          {
            id: `bot-cron-${Date.now()}`,
            sender: 'bot',
            timestamp: nowTime(),
            type: 'recipe_alert',
            expiringItems: result.expiringItems ?? expiringSoonItems,
            aiData: result.aiData,
          },
        ]);
      } else {
        const targetExpiring =
          expiringSoonItems.length > 0 ? expiringSoonItems : activeItems.slice(0, 2);
        const otherValid = activeItems.filter(
          (i) => !targetExpiring.some((exp) => exp.id === i.id)
        );
        const fallbackData: CronRunResult['aiData'] = {
          resumo_alerta: `Identificamos ${targetExpiring.length} item(ns) na janela crítica de 5 dias! Cruzamos com seu estoque ativo:`,
          aiMode: 'fallback',
          modelUsed: 'offline-demo',
          receitas: [
            {
              titulo: 'Shake Proteico Funcional Anti-Desperdício',
              tempo_preparo: '5 minutos',
              dificuldade: 'Muito Fácil',
              ingredientes_usados: [
                ...targetExpiring.map((i) => `${i.produto} (${i.diasRestantes}d)`),
                ...otherValid.slice(0, 2).map((i) => i.produto),
              ],
              passo_a_passo: [
                'Adicione os itens próximos do vencimento no liquidificador com 200 ml de água gelada.',
                'Acrescente Whey Protein e Aveia do seu estoque ativo.',
                'Bata por 45 segundos e consuma imediatamente.',
              ],
              dica_nutricional:
                'Alta densidade proteica e aproveitamento integral dos perecíveis.',
              termo_busca_link: 'receita shake proteico banana pasta de amendoim whey',
            },
            {
              titulo: 'Panqueca Fit de Aveia e Pasta de Amendoim',
              tempo_preparo: '10 minutos',
              dificuldade: 'Fácil',
              ingredientes_usados: [
                ...targetExpiring.map((i) => i.produto),
                'Ovos Caipiras',
                'Aveia em Flocos Finos',
              ],
              passo_a_passo: [
                'Amasse a banana madura e misture com 2 ovos e 2 colheres de aveia.',
                'Doure em frigideira antiaderente por 2 minutos de cada lado.',
                'Finalize com 1 colher de sopa de Pasta de Amendoim Zero Lactose.',
              ],
              dica_nutricional: 'Excelente opção pré-treino com desperdício zero.',
              termo_busca_link: 'panqueca fit banana aveia pasta de amendoim',
            },
          ],
        };

        setActiveCronStep(5);
        await wait(300);

        const offlineResult: CronRunResult = {
          timestamp: nowTime(),
          expiringCount: targetExpiring.length,
          otherCount: otherValid.length,
          expiringItems: targetExpiring,
          aiData: fallbackData,
        };
        setLastCronResult(offlineResult);
        setCronLogs([
          {
            time: `${nowTime()}:01`,
            node: 'Schedule Trigger (Offline Demo)',
            status: 'OK',
            detail: 'Simulação iniciada localmente',
          },
          {
            time: `${nowTime()}:02`,
            node: 'Filtro <= 5 dias',
            status: 'OK',
            detail: `${targetExpiring.length} item(ns) crítico(s) cruzados com ${otherValid.length} válidos`,
          },
          {
            time: `${nowTime()}:03`,
            node: 'Curadoria Demo',
            status: 'WARN',
            detail: 'Inicie o backend + GEMINI_API_KEY para receitas geradas em tempo real pelo Gemini',
          },
        ]);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `bot-cron-${Date.now()}`,
            sender: 'bot',
            timestamp: nowTime(),
            type: 'recipe_alert',
            expiringItems: targetExpiring,
            aiData: fallbackData,
          },
        ]);
      }

      if (switchToChat) setActiveTab('bot');
    } finally {
      setIsRunningCron(false);
      setTimeout(() => setActiveCronStep(0), 1200);
    }
  };

  // =========================================================================
  // COMANDOS DO CHAT (RF05)
  // =========================================================================
  const handleSendCommand = async (rawText: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: `usr-cmd-${Date.now()}`,
        sender: 'user',
        timestamp: nowTime(),
        type: 'text',
        text: rawText,
      },
    ]);

    const lower = rawText.toLowerCase();

    if (backendOnline) {
      try {
        const res = await apiClient.sendChatCommand(rawText);
        if (res.updatedItem) {
          setInventory((prev) =>
            prev.map((item) => (item.id === res.updatedItem!.id ? res.updatedItem! : item))
          );
        }
        if (res.cronResult) {
          setLastCronResult(res.cronResult);
          if (res.cronResult.logs) setCronLogs(res.cronResult.logs);
          setChatMessages((prev) => [
            ...prev,
            {
              id: `bot-cmd-cron-${Date.now()}`,
              sender: 'bot',
              timestamp: nowTime(),
              type: 'recipe_alert',
              expiringItems: res.cronResult!.expiringItems ?? expiringSoonItems,
              aiData: res.cronResult!.aiData,
            },
          ]);
          return;
        }

        setChatMessages((prev) => [
          ...prev,
          {
            id: `bot-cmd-${Date.now()}`,
            sender: 'bot',
            timestamp: nowTime(),
            type: 'text',
            text: res.replyText,
          },
        ]);
        return;
      } catch {
        // Segue para tratamento local se a chamada falhar
      }
    }

    if (lower === '/alerta' || lower.includes('receita')) {
      void triggerMidnightCronJob(true);
      return;
    }

    if (lower === '/estoque' || lower.startsWith('/estoque ')) {
      const sorted = [...activeItems].sort((a, b) => a.diasRestantes - b.diasRestantes);
      const listStr =
        sorted.length === 0
          ? 'Sua despensa ativa está vazia no momento.'
          : sorted
              .map((i) => {
                const icon = i.diasRestantes <= 5 ? '⚠️' : '🟢';
                return `${icon} **#${i.id} ${i.produto}** — Vence: ${i.data_validade} (${i.diasRestantes}d)`;
              })
              .join('\n');

      setChatMessages((prev) => [
        ...prev,
        {
          id: `bot-est-${Date.now()}`,
          sender: 'bot',
          timestamp: nowTime(),
          type: 'text',
          text: `📋 **Itens em Estoque (${sorted.length}):**\n\n${listStr}\n\n💡 _Envie_ \`/consumido <id>\` _para dar baixa em um item específico._`,
        },
      ]);
      return;
    }

    if (lower === '/consumido' || lower.startsWith('/consumido ')) {
      const arg = rawText.slice('/consumido'.length).trim();
      const sorted = [...activeItems].sort((a, b) => a.diasRestantes - b.diasRestantes);
      let target: EnrichedPantryItem | undefined;
      if (!arg) {
        target = sorted[0];
      } else if (/^#?\d+$/.test(arg)) {
        const parsedId = Number(arg.replace('#', ''));
        target = sorted.find((i) => i.id === parsedId);
      } else {
        target = sorted.find((i) => i.produto.toLowerCase().includes(arg.toLowerCase()));
      }

      if (!target) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `bot-cons-nf-${Date.now()}`,
            sender: 'bot',
            timestamp: nowTime(),
            type: 'text',
            text: `❌ Não encontrei item ativo para "${arg || 'baixa'}". Envie \`/estoque\` para ver os IDs.`,
          },
        ]);
        return;
      }

      setInventory((prev) =>
        prev.map((i) => (i.id === target!.id ? enrichPantryItem({ ...i, status: 'Consumido' }) : i))
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: `bot-cons-${Date.now()}`,
          sender: 'bot',
          timestamp: nowTime(),
          type: 'text',
          text: `🍽️ **Baixa registrada (RF05)!**\nO item **#${target.id} ${target.produto}** foi marcado como **Consumido**.`,
        },
      ]);
      return;
    }

    setChatMessages((prev) => [
      ...prev,
      {
        id: `bot-help-${Date.now()}`,
        sender: 'bot',
        timestamp: nowTime(),
        type: 'text',
        text: '🤖 **Comandos suportados:**\n• Envie uma **foto** da embalagem para OCR\n• `/estoque` — Lista o estoque ativo\n• `/consumido <id ou nome>` — Dá baixa no item\n• `/alerta` — Dispara o cruzamento de receitas IA',
      },
    ]);
  };

  // =========================================================================
  // CRUD DA DESPENSA (RF04)
  // =========================================================================
  const handleAddManualItem = async (payload: {
    produto: string;
    categoria: PantryCategory;
    diasRestantes: number;
  }) => {
    if (backendOnline) {
      const res = await apiClient.createPantryItem({
        produto: payload.produto,
        categoria: payload.categoria,
        diasRestantes: payload.diasRestantes,
        confianca_ocr: 'Manual',
      });
      setInventory((prev) => [res.item, ...prev]);
      return;
    }

    const id = nextDemoId;
    setNextDemoId((n) => n + 1);
    const created = enrichPantryItem({
      id,
      user_id: 'usr_telegram_99412',
      produto: payload.produto,
      categoria: payload.categoria,
      data_cadastro: addDaysToToday(0),
      data_validade: addDaysToToday(payload.diasRestantes),
      status: payload.diasRestantes < 0 ? 'Vencido' : 'Em estoque',
      confianca_ocr: 'Manual',
    });
    setInventory((prev) => [created, ...prev]);
  };

  const handleShiftItemDate = async (id: number, deltaDays: number) => {
    if (backendOnline) {
      const res = await apiClient.shiftItemDate(id, deltaDays);
      setInventory((prev) => prev.map((i) => (i.id === id ? res.item : i)));
      return;
    }

    setInventory((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updatedDate = shiftDateString(item.data_validade, deltaDays);
        const daysLeft = calculateDaysRemaining(updatedDate);
        return enrichPantryItem({
          ...item,
          data_validade: updatedDate,
          status:
            item.status === 'Consumido'
              ? 'Consumido'
              : daysLeft < 0
              ? 'Vencido'
              : 'Em estoque',
        });
      })
    );
  };

  const handleToggleConsumed = async (id: number) => {
    const target = inventory.find((i) => i.id === id);
    if (!target) return;
    const nextStatus = target.status === 'Consumido' ? 'Em estoque' : 'Consumido';

    if (backendOnline) {
      const res = await apiClient.updateItemStatus(id, nextStatus);
      setInventory((prev) => prev.map((i) => (i.id === id ? res.item : i)));
      return;
    }

    setInventory((prev) =>
      prev.map((i) => (i.id === id ? enrichPantryItem({ ...i, status: nextStatus }) : i))
    );
  };

  const handleDeleteItem = async (id: number) => {
    if (backendOnline) {
      await apiClient.deleteItem(id);
    }
    setInventory((prev) => prev.filter((i) => i.id !== id));
  };

  const handleLoadWeeklySummary = async () => {
    if (backendOnline) {
      try {
        const report = await apiClient.getWeeklySummary();
        setWeeklySummary(report);
        return;
      } catch {
        // fallback abaixo
      }
    }

    const consumedCount = inventory.filter((i) => i.computedStatus === 'Consumido').length;
    const closed = consumedCount + expiredItems.length;
    const rate = closed > 0 ? Math.round((consumedCount / closed) * 100) : 100;
    const soon = activeItems.filter((i) => i.diasRestantes >= 0 && i.diasRestantes <= 7);

    setWeeklySummary({
      generatedAt: new Date().toISOString(),
      totalActive: activeItems.length,
      expiringSoonCount: soon.length,
      consumedCount,
      expiredCount: expiredItems.length,
      wastePreventionRate: rate,
      expiringSoonItems: soon,
      emailSubject: `[Smart Pantry] Resumo Semanal: ${soon.length} item(ns) na janela de atenção`,
      emailBodyMarkdown: `Olá!\n\nResumo semanal da sua despensa:\n• Em estoque: ${activeItems.length}\n• Vencendo em até 7 dias: ${soon.length}\n• Consumidos: ${consumedCount}\n• Vencidos: ${expiredItems.length}\n• Aproveitamento: ${rate}%\n\nPrioridades:\n${
        soon.map((i) => `- ${i.produto} (${i.data_validade})`).join('\n') || '- Nenhum item crítico!'
      }`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        inventoryCount={inventory.length}
        activeCount={activeItems.length}
        expiringSoonCount={expiringSoonItems.length}
        expiredCount={expiredItems.length}
        isRunningCron={isRunningCron}
        onRunCron={() => void triggerMidnightCronJob(true)}
        backendOnline={backendOnline}
        health={health}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'bot' && (
          <BotSimulatorTab
            chatMessages={chatMessages}
            isProcessingOCR={isProcessingOCR}
            pendingConfirmation={pendingConfirmation}
            backendOnline={backendOnline}
            geminiConfigured={Boolean(health?.geminiConfigured)}
            geminiModel={health?.geminiModel || 'gemini-3.5-flash-lite'}
            hasLastUploadedPhoto={Boolean(lastUploadedFile)}
            onConfigureGemini={handleConfigureGemini}
            onReanalyzeLastPhoto={() => {
              if (lastUploadedFile) handleRealImageUpload(lastUploadedFile);
            }}
            onSimulateSamplePhoto={handleSimulateSamplePhoto}
            onRealImageUpload={handleRealImageUpload}
            onConfirmSave={(prod, dt) => void handleConfirmSave(prod, dt)}
            onDiscardPending={handleDiscardPending}
            onSendCommand={(txt) => void handleSendCommand(txt)}
          />
        )}

        {activeTab === 'supabase' && (
          <InventoryTab
            items={inventory}
            storageMode={backendOnline && health ? health.storageMode : 'demo-memory'}
            onAddManualItem={(payload) => void handleAddManualItem(payload)}
            onShiftItemDate={(id, delta) => void handleShiftItemDate(id, delta)}
            onToggleConsumed={(id) => void handleToggleConsumed(id)}
            onDeleteItem={(id) => void handleDeleteItem(id)}
          />
        )}

        {activeTab === 'n8n' && (
          <AutomationTab
            activeItems={activeItems}
            expiringSoonItems={expiringSoonItems}
            isRunningCron={isRunningCron}
            activeCronStep={activeCronStep}
            lastCronResult={lastCronResult}
            cronLogs={cronLogs}
            weeklySummary={weeklySummary}
            onRunCron={() => void triggerMidnightCronJob(false)}
            onLoadWeeklySummary={() => void handleLoadWeeklySummary()}
          />
        )}

        {activeTab === 'antigravity' && <PlanningHubTab />}
      </main>
    </div>
  );
}
