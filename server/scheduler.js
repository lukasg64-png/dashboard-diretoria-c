const cron = require('node-cron');
const etl = require('./etl');

function initScheduler() {
  console.log('[Scheduler] Agendador de sincronização diária VTEX ativado.');
  console.log('[Scheduler] Horário agendado: Todos os dias às 08:00 AM (0 8 * * *).');

  // Cron Job: 08:00 AM todos os dias
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Disparando atualização programada das 08:00 AM...');
    try {
      await etl.runETL();
      console.log('[Scheduler] Sincronização das 08:00 AM concluída!');
    } catch (e) {
      console.error('[Scheduler] Erro na sincronização das 08:00 AM:', e.message);
    }
  }, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
  });

  // Verificação inicial na inicialização do servidor
  const cache = etl.loadCache();
  const lastSyncStr = cache.lastSync;
  const todayStr = new Date().toISOString().slice(0, 10);
  
  if (!lastSyncStr || !lastSyncStr.startsWith(todayStr) || Object.keys(cache.orders || {}).length === 0) {
    console.log('[Scheduler] Base sem sincronização no dia de hoje. Iniciando carga inicial em segundo plano...');
    setTimeout(() => {
      etl.runETL().catch(err => console.error('[Scheduler] Erro na carga inicial:', err.message));
    }, 2000);
  } else {
    console.log(`[Scheduler] Base atualizada hoje (${lastSyncStr}). Próxima sincronização agendada para amanhã às 08:00 AM.`);
  }
}

module.exports = {
  initScheduler
};
