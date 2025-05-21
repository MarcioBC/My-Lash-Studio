// relatorios.js (VERSÃO FINAL CORRIGIDA COM DATA E HORA)

document.addEventListener('DOMContentLoaded', () => {
    console.log('1. relatorios.js foi carregado e o DOM está pronto!');

    const btnPendentes = document.getElementById('btnPendentes');
    const btnConfirmados = document.getElementById('btnConfirmados');
    const btnCancelados = document.getElementById('btnCancelados');
    const reportDateInput = document.getElementById('reportDate');
    const btnDia = document.getElementById('btnDia');
    const btnSemana = document.getElementById('btnSemana');
    const btnMes = document.getElementById('btnMes');
    const relatorioContent = document.getElementById('relatorioContent');

    console.log('2. Elementos HTML selecionados:');
    console.log('   btnPendentes:', btnPendentes);
    console.log('   btnConfirmados:', btnConfirmados);
    console.log('   btnCancelados:', btnCancelados);
    console.log('   reportDateInput:', reportDateInput);
    console.log('   btnDia:', btnDia);
    console.log('   btnSemana:', btnSemana);
    console.log('   btnMes:', btnMes);
    console.log('   relatorioContent:', relatorioContent);


    // Função auxiliar para formatar data (se necessário no futuro, mas 'data' já vem formatada do backend)
    function formatDate(dateString) {
        // Se a data já vem formatada do backend (ex: 'DD/MM/YYYY'), basta retorná-la
        if (!dateString) return 'N/A';
        return dateString;
    }

    async function fetchRelatorio(endpoint, params = {}) {
        let url = `http://localhost:3001/api/relatorios/${endpoint}`;
        if (Object.keys(params).length > 0) {
            const query = new URLSearchParams(params).toString();
            url += `?${query}`;
        }

        console.log('3. URL da requisição:', url);
        relatorioContent.innerHTML = '<p>Carregando dados do relatório...</p>';

        try {
            const response = await fetch(url);
            console.log('4. Resposta da API recebida:', response);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro na resposta da API - Status:', response.status, 'Corpo do Erro:', errorText);
                throw new Error(`Erro ao buscar relatório: ${response.status} - ${errorText || 'Erro de rede ou servidor.'}`);
            }
            const data = await response.json();
            console.log('5. Dados recebidos da API:', data);
            displayRelatorio(data, endpoint);
        } catch (error) {
            console.error('Erro no fetchRelatorio:', error);
            relatorioContent.innerHTML = `<p style="color: red;">Erro ao carregar o relatório: ${error.message}. Verifique o console para mais detalhes.</p>`;
        }
    }

    function displayRelatorio(agendamentos, tipoRelatorio) {
        console.log('6. Tentando exibir relatório. Agendamentos recebidos:', agendamentos);
        // Garante que agendamentos é um array e não está vazio
        if (!Array.isArray(agendamentos) || agendamentos.length === 0) {
            relatorioContent.innerHTML = `<p class="no-data-message">Nenhum agendamento encontrado para este relatório.</p>`;
            return;
        }

        let html = `<h2>${getReportTitle(tipoRelatorio)}</h2>`;
        html += `<table>
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Procedimento(s)</th>
                            <th>Data</th>
                            <th>Hora</th>
                            <th>Status</th>
                            <th>Valor Total</th>
                            <th>ID</th>
                        </tr>
                    </thead>
                    <tbody>`;

        agendamentos.forEach(agendamento => {
            console.log('Processando agendamento:', agendamento);
            // Acessando 'clienteNome', 'procedimentos', 'data', 'hora' e 'valorTotal'
            const clienteNome = agendamento.clienteNome || 'N/A';
            const procedimentosNomes = (agendamento.procedimentos && agendamento.procedimentos.length > 0)
                ? agendamento.procedimentos.map(p => p.nome).join(', ')
                : 'N/A';

            // Aqui está a correção para garantir que 'data' e 'hora' sejam exibidas
            // Elas devem vir já formatadas do backend, como planejado no server.js
            const dataAgendamento = agendamento.data || 'N/A';
            const horaAgendamento = agendamento.hora || 'N/A';


            html += `<tr>
                        <td>${clienteNome}</td>
                        <td>${procedimentosNomes}</td>
                        <td>${dataAgendamento}</td>
                        <td>${horaAgendamento}</td>
                        <td>${agendamento.status || 'N/A'}</td>
                        <td>R$ ${parseFloat(agendamento.valorTotal || 0).toFixed(2).replace('.', ',')}</td>
                        <td>${agendamento._id || 'N/A'}</td>
                    </tr>`;
        });

        html += `</tbody></table>`;
        relatorioContent.innerHTML = html;
    }

    function getReportTitle(type) {
        switch(type) {
            case 'status/pendente': return 'Relatório de Agendamentos Pendentes';
            case 'status/confirmado': return 'Relatório de Agendamentos Confirmados';
            case 'status/cancelado': return 'Relatório de Agendamentos Cancelados';
            case 'agendamentos/dia': return `Relatório Diário (${reportDateInput.value ? formatDate(reportDateInput.value) : 'N/A'})`;
            case 'agendamentos/semana': return `Relatório Semanal (a partir de ${reportDateInput.value ? formatDate(reportDateInput.value) : 'N/A'})`;
            case 'agendamentos/mes': return `Relatório Mensal (a partir de ${reportDateInput.value ? formatDate(reportDateInput.value) : 'N/A'})`;
            default: return 'Relatório de Agendamentos';
        }
    }

    // Event Listeners para os botões
    if (btnPendentes) {
        btnPendentes.addEventListener('click', () => {
            console.log('Botão "Agendamentos Pendentes" clicado!');
            fetchRelatorio('status/pendente');
        });
    } else {
        console.error('Erro: Botão btnPendentes não encontrado no DOM.');
    }

    if (btnConfirmados) {
        btnConfirmados.addEventListener('click', () => {
            console.log('Botão "Agendamentos Confirmados" clicado!');
            fetchRelatorio('status/confirmado');
        });
    } else {
        console.error('Erro: Botão btnConfirmados não encontrado no DOM.');
    }

    if (btnCancelados) {
        btnCancelados.addEventListener('click', () => {
            console.log('Botão "Agendamentos Cancelados" clicado!');
            fetchRelatorio('status/cancelado');
        });
    } else {
        console.error('Erro: Botão btnCancelados não encontrado no DOM.');
    }

    // Agora que as rotas estão no server.js, vamos ativá-las!
    if (btnDia) {
        btnDia.addEventListener('click', () => {
            console.log('Botão "Relatório Diário" clicado!');
            const date = reportDateInput.value;
            if (date) {
                // Endpoint é 'agendamentos/dia' e o parâmetro é 'date'
                fetchRelatorio('agendamentos/dia', { date: date });
            } else {
                alert('Por favor, selecione uma data de referência para o relatório diário.');
            }
        });
    } else {
        console.error('Erro: Botão btnDia não encontrado no DOM.');
    }

    if (btnSemana) {
        btnSemana.addEventListener('click', () => {
            console.log('Botão "Relatório Semanal" clicado!');
            const date = reportDateInput.value;
            if (date) {
                // Endpoint é 'agendamentos/semana' e o parâmetro é 'date'
                fetchRelatorio('agendamentos/semana', { date: date });
            } else {
                alert('Por favor, selecione uma data de referência para o relatório semanal.');
            }
        });
    } else {
        console.error('Erro: Botão btnSemana não encontrado no DOM.');
    }

    if (btnMes) {
        btnMes.addEventListener('click', () => {
            console.log('Botão "Relatório Mensal" clicado!');
            const date = reportDateInput.value;
            if (date) {
                // Endpoint é 'agendamentos/mes' e o parâmetro é 'date'
                fetchRelatorio('agendamentos/mes', { date: date });
            } else {
                alert('Por favor, selecione uma data de referência para o relatório mensal.');
            }
        });
    } else {
        console.error('Erro: Botão btnMes não encontrado no DOM.');
    }
});