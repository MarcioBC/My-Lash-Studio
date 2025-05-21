const express = require('express');
const fs = require('fs'); // Mantenha o fs para as funções originais
const fsp = require('fs/promises'); // Importa a versão de Promises para async/await
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const port = 3001;

// Define os caminhos para os arquivos JSON
const USERS_FILE = path.join(__dirname, 'users.json');
const CLIENTES_FILE = path.join(__dirname, 'clientes_db.json');
const AGENDAMENTOS_FILE = path.join(__dirname, 'agendamentos.json');
const TRANSACOES_FILE = path.join(__dirname, 'transacoes.json');
const PROCEDURES_FILE = path.join(__dirname, 'procedures.json'); // Adicionado, presumindo que você tenha um arquivo procedures.json

// Middleware para permitir CORS
app.use(cors());

// Middleware para analisar o corpo das requisições como JSON
app.use(express.json());

// Middleware para servir arquivos estáticos da pasta raiz (onde frontend está)
app.use(express.static(path.join(__dirname, '..'))); // Navega para a pasta pai (raiz do projeto)

// --- NOVAS Funções Auxiliares para ler/escrever JSONs com Promises (ASYNC/AWAIT) ---
async function readJsonFile(filePath) {
    try {
        const data = await fsp.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') { // Arquivo não encontrado
            return []; // Retorna um array vazio se o arquivo não existir
        }
        console.error(`Erro ao ler o arquivo ${filePath}:`, error);
        throw error; // Re-lança o erro para ser capturado pela rota
    }
}

async function writeJsonFile(filePath, data) {
    try {
        await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erro ao escrever no arquivo ${filePath}:`, error);
        throw error; // Re-lança o erro
    }
}
// --- Fim das NOVAS Funções Auxiliares ---


// --- Funções Auxiliares de Data para Relatórios ---
const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

const isSameWeek = (date1, date2) => {
    const startOfWeek1 = new Date(date1);
    startOfWeek1.setDate(date1.getDate() - date1.getDay()); // Primeiro dia da semana (domingo)
    startOfWeek1.setHours(0, 0, 0, 0);

    const startOfWeek2 = new Date(date2);
    startOfWeek2.setDate(date2.getDate() - date2.getDay()); // Primeiro dia da semana (domingo)
    startOfWeek2.setHours(0, 0, 0, 0);

    return isSameDay(startOfWeek1, startOfWeek2);
};

const isSameMonth = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth();
};
// --- Fim das Funções Auxiliares de Data ---


// Funções para ler/salvar usuários (Mantenho as suas funções síncronas para não alterar o comportamento)
const readUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        console.error('Erro ao ler o arquivo de usuários:', error);
        return [];
    }
};

const saveUsers = (users) => {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Erro ao escrever no arquivo de usuários:', error);
        return false;
    }
};

// Rotas de Autenticação
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }
    const users = readUsers();
    if (users.some(user => user.username === username)) {
        return res.status(409).json({ message: 'Nome de usuário já existe.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { username, email, password: hashedPassword };
        users.push(newUser);
        if (saveUsers(users)) {
            res.status(201).json({ message: 'Usuário registrado com sucesso!' });
        } else {
            res.status(500).json({ message: 'Erro ao salvar o usuário.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Erro interno ao processar o registro.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
        res.status(200).json({ message: 'Login realizado com sucesso!' });
    } else {
        res.status(401).json({ message: 'Credenciais inválidas.' });
    }
});

// --- Rotas de Clientes (CRUD) - AGORA USANDO ASYNC/AWAIT E VALIDAÇÃO DE CELULAR ---

app.get('/api/clients', async (req, res) => {
    try {
        const clientes = await readJsonFile(CLIENTES_FILE);
        res.json(clientes);
    } catch (error) {
        console.error('Erro na rota GET /api/clients:', error);
        res.status(500).json({ message: 'Erro ao carregar os clientes.' });
    }
});

app.post('/api/clients', async (req, res) => {
    const novoCliente = req.body;

    if (!novoCliente.name) {
        return res.status(400).json({ message: 'O nome do cliente é obrigatório.' });
    }
    // Validação: O número de celular é obrigatório
    if (!novoCliente.phone) {
        return res.status(400).json({ message: 'O número de celular é obrigatório para o cadastro.' });
    }

    try {
        const clientes = await readJsonFile(CLIENTES_FILE);

        // Normalização do número de celular para comparação
        const normalizedNewPhone = novoCliente.phone.replace(/\D/g, ''); // Remove tudo que não for dígito

        // Verifica se já existe um cliente com o mesmo número de celular normalizado
        const clienteExistente = clientes.find(cliente =>
            cliente.phone && cliente.phone.replace(/\D/g, '') === normalizedNewPhone
        );

        if (clienteExistente) {
            console.log(`Tentativa de cadastrar cliente duplicado pelo celular: ${novoCliente.phone}`);
            return res.status(409).json({ message: 'Já existe um cliente cadastrado com este número de celular.' }); // 409 Conflict
        }

        const lastId = clientes.length > 0 ? Math.max(...clientes.map(c => parseInt(c._id || 0))) : 0;
        novoCliente._id = String(lastId + 1);

        // Salva o número de telefone já normalizado no banco de dados (altamente recomendado)
        novoCliente.phone = normalizedNewPhone;

        clientes.push(novoCliente);

        await writeJsonFile(CLIENTES_FILE, clientes);
        console.log(`Cliente "${novoCliente.name}" (Celular: ${novoCliente.phone}) cadastrado com sucesso. ID: ${novoCliente._id}`);
        res.status(201).json({ message: 'Cliente cadastrado com sucesso!', cliente: novoCliente });
    } catch (error) {
        console.error('Erro na rota POST /api/clients ao salvar cliente:', error);
        res.status(500).json({ message: 'Erro ao salvar o cliente.' });
    }
});

app.put('/api/clients/:id', async (req, res) => { // Tornar a rota async
    const clientIdToUpdate = req.params.id;
    const updatedClientData = req.body;
    try {
        const clientes = await readJsonFile(CLIENTES_FILE); // Usar async/await
        const clientIndex = clientes.findIndex(cliente => cliente._id === clientIdToUpdate);
        if (clientIndex === -1) {
            return res.status(404).send('Cliente não encontrado.');
        }
        clientes[clientIndex] = { ...clientes[clientIndex], ...updatedClientData, _id: clientIdToUpdate };
        await writeJsonFile(CLIENTES_FILE, clientes); // Usar async/await
        res.status(200).json({ message: 'Cliente atualizado com sucesso!', cliente: clientes[clientIndex] });
    } catch (error) {
        console.error('Erro na rota PUT /api/clients:', error);
        res.status(500).send('Erro ao atualizar o cliente.');
    }
});

app.delete('/api/clients/:id', async (req, res) => { // Tornar a rota async
    const clientIdToDelete = req.params.id;
    try {
        let clientes = await readJsonFile(CLIENTES_FILE); // Usar async/await
        const initialLength = clientes.length;
        clientes = clientes.filter(cliente => cliente._id !== clientIdToDelete);
        if (clientes.length === initialLength) {
            return res.status(404).send('Cliente não encontrado.');
        }
        await writeJsonFile(CLIENTES_FILE, clientes); // Usar async/await
        res.status(200).json({ message: 'Cliente excluído com sucesso!' });
    } catch (error) {
        console.error('Erro na rota DELETE /api/clients:', error);
        res.status(500).send('Erro ao excluir o cliente.');
    }
});

// --- Rotas de Agendamentos (CRUD) - AGORA USANDO ASYNC/AWAIT NAS FUNÇÕES DE ARQUIVO ---
app.get('/api/agendamentos', async (req, res) => {
    try {
        const agendamentos = await readJsonFile(AGENDAMENTOS_FILE);
        res.json(agendamentos);
    } catch (error) {
        console.error('Erro na rota GET /api/agendamentos:', error);
        res.status(500).json({ message: 'Erro ao carregar os agendamentos.' });
    }
});

app.post('/api/agendamentos', async (req, res) => {
    const novoAgendamento = req.body;
    try {
        let agendamentos = await readJsonFile(AGENDAMENTOS_FILE);

        const lastId = agendamentos.length > 0 ? Math.max(...agendamentos.map(a => parseInt(a._id || 0))) : 0;
        novoAgendamento._id = String(lastId + 1);
        novoAgendamento.status = "pendente"; // Define o status inicial como pendente

        // Garante que os novos agendamentos usem 'data' e 'hora'
        if (novoAgendamento.date && !novoAgendamento.data) {
            novoAgendamento.data = novoAgendamento.date;
            delete novoAgendamento.date; // Remove a propriedade antiga
        }
        if (novoAgendamento.time && !novoAgendamento.hora) {
            novoAgendamento.hora = novoAgendamento.time;
            delete novoAgendamento.time; // Remove a propriedade antiga
        }

        agendamentos.push(novoAgendamento);

        await writeJsonFile(AGENDAMENTOS_FILE, agendamentos);
        res.status(201).json({ message: 'Agendamento salvo com sucesso!', agendamento: novoAgendamento });
    } catch (error) {
        console.error('Erro na rota POST /api/agendamentos:', error);
        res.status(500).json({ message: 'Erro ao salvar o agendamento.' });
    }
});

app.delete('/api/agendamentos/:id', async (req, res) => {
    const agendamentoIdToDelete = req.params.id;
    try {
        let agendamentos = await readJsonFile(AGENDAMENTOS_FILE);
        const initialLength = agendamentos.length;
        agendamentos = agendamentos.filter(agendamento => agendamento._id !== agendamentoIdToDelete);
        if (agendamentos.length === initialLength) {
            return res.status(404).send('Agendamento não encontrado.');
        }
        await writeJsonFile(AGENDAMENTOS_FILE, agendamentos);
        res.status(200).json({ message: 'Agendamento excluído com sucesso!' });
    } catch (error) {
        console.error('Erro na rota DELETE /api/agendamentos:', error);
        res.status(500).send('Erro ao excluir o agendamento.');
    }
});

app.put('/api/agendamentos/:id', async (req, res) => {
    const agendamentoIdToUpdate = req.params.id;
    const updatedAgendamentoData = req.body;
    try {
        const agendamentos = await readJsonFile(AGENDAMENTOS_FILE);
        const agendamentoIndex = agendamentos.findIndex(agendamento => agendamento._id === agendamentoIdToUpdate);
        if (agendamentoIndex === -1) {
            return res.status(404).send('Agendamento não encontrado.');
        }

        // Garante que as atualizações usem 'data' e 'hora'
        if (updatedAgendamentoData.date && !updatedAgendamentoData.data) {
            updatedAgendamentoData.data = updatedAgendamentoData.date;
            delete updatedAgendamentoData.date;
        }
        if (updatedAgendamentoData.time && !updatedAgendamentoData.hora) {
            updatedAgendamentoData.hora = updatedAgendamentoData.time;
            delete updatedAgendamentoData.time;
        }

        agendamentos[agendamentoIndex] = {
            ...agendamentos[agendamentoIndex],
            ...updatedAgendamentoData,
            _id: agendamentoIdToUpdate
        };
        await writeJsonFile(AGENDAMENTOS_FILE, agendamentos);
        res.status(200).json({ message: 'Agendamento atualizado com sucesso!', agendamento: agendamentos[agendamentoIndex] });
    } catch (error) {
        console.error('Erro na rota PUT /api/agendamentos:', error);
        res.status(500).send('Erro ao atualizar o agendamento.');
    }
});

// Rota para CONFIRMAR um agendamento - AGORA USANDO ASYNC/AWAIT
app.put('/api/agendamentos/:id/confirmar', async (req, res) => {
    const agendamentoId = req.params.id;

    try {
        let agendamentos = await readJsonFile(AGENDAMENTOS_FILE);
        const agendamentoIndex = agendamentos.findIndex(a => a._id === agendamentoId);

        if (agendamentoIndex === -1) {
            return res.status(404).json({ message: 'Agendamento não encontrado.' });
        }

        let agendamento = agendamentos[agendamentoIndex];

        if (agendamento.status === 'confirmado') {
            return res.status(400).json({ message: 'Agendamento já está confirmado.' });
        }
        if (agendamento.status === 'cancelado') {
            return res.status(400).json({ message: 'Agendamento está cancelado e não pode ser confirmado.' });
        }

        // Define o status do agendamento como 'confirmado'
        agendamento.status = 'confirmado';
        await writeJsonFile(AGENDAMENTOS_FILE, agendamentos);

        // Lógica para criar a transação de receita
        let transacoes = await readJsonFile(TRANSACOES_FILE);
        let clientes = await readJsonFile(CLIENTES_FILE);

        const cliente = clientes.find(c => String(c._id) === String(agendamento.clientId));
        const clienteNome = cliente ? cliente.name : 'Cliente Removido';

        const procedimentosNomes = (agendamento.procedimentos && Array.isArray(agendamento.procedimentos) && agendamento.procedimentos.length > 0) ?
            agendamento.procedimentos.map(p => p.nome || p.name || 'Procedimento').join(', ') : '';
        let descricaoTransacao = `Agendamento - ${clienteNome}${procedimentosNomes ? ` (${procedimentosNomes})` : ''}`;

        // Garante que a transação use 'data'
        const transacaoData = (agendamento.data || agendamento.date) ? new Date(agendamento.data || agendamento.date).toISOString().split('T')[0] : 'N/A'; // Formato YYYY-MM-DD


        const novaTransacao = {
            _id: String(transacoes.length > 0 ? Math.max(...transacoes.map(t => parseInt(t._id || 0))) + 1 : 1),
            tipo: 'receita',
            descricao: descricaoTransacao,
            valor: parseFloat(agendamento.valorTotal || 0), // Garante que é um número
            data: transacaoData, // Usa a data normalizada
            origem: 'agendamento',
            origemId: agendamentoId
        };

        const existingTransaction = transacoes.find(t =>
            t.origem === 'agendamento' &&
            t.origemId === agendamentoId &&
            t.tipo === 'receita'
        );

        if (!existingTransaction) {
            transacoes.push(novaTransacao);
            await writeJsonFile(TRANSACOES_FILE, transacoes);
            res.json({ message: 'Agendamento confirmado e transação de receita criada com sucesso!' });
        } else {
            console.log('Transação de receita para este agendamento já existe, não duplicando.');
            res.json({ message: 'Agendamento confirmado (transação de receita já existe).' });
        }
    } catch (error) {
        console.error('Erro na rota PUT /api/agendamentos/:id/confirmar:', error);
        res.status(500).json({ message: 'Erro ao confirmar agendamento ou criar transação de receita.' });
    }
});


// Rota para CANCELAR um agendamento - AGORA USANDO ASYNC/AWAIT
app.put('/api/agendamentos/:id/cancelar', async (req, res) => {
    const agendamentoId = req.params.id;
    try {
        let agendamentos = await readJsonFile(AGENDAMENTOS_FILE);
        const agendamentoIndex = agendamentos.findIndex(a => a._id === agendamentoId);

        if (agendamentoIndex === -1) {
            return res.status(404).send('Agendamento não encontrado.');
        }
        if (agendamentos[agendamentoIndex].status === 'cancelado') {
            return res.status(400).send('Agendamento já está cancelado.');
        }

        agendamentos[agendamentoIndex].status = 'cancelado';
        await writeJsonFile(AGENDAMENTOS_FILE, agendamentos);
        res.status(200).json({ message: 'Agendamento cancelado com sucesso!', agendamento: agendamentos[agendamentoIndex] });
    } catch (error) {
        console.error('Erro na rota PUT /api/agendamentos/:id/cancelar:', error);
        res.status(500).send('Erro ao cancelar agendamento.');
    }
});

// NOVA ROTA DE RELATÓRIOS DE AGENDAMENTOS POR STATUS
app.get('/api/relatorios/status/:status', async (req, res) => {
    const requestedStatus = req.params.status.toLowerCase(); // 'pendente', 'confirmado', 'cancelado'

    const validStatuses = ['pendente', 'confirmado', 'cancelado'];
    if (!validStatuses.includes(requestedStatus)) {
        return res.status(400).json({ message: 'Status de agendamento inválido. Use "pendente", "confirmado" ou "cancelado".' });
    }

    try {
        const agendamentos = await readJsonFile(AGENDAMENTOS_FILE);
        const clientes = await readJsonFile(CLIENTES_FILE); // Para enriquecer com nome do cliente
        const procedures = await readJsonFile(PROCEDURES_FILE); // Para enriquecer com nome dos procedimentos

        const filteredAgendamentos = agendamentos.filter(agendamento =>
            agendamento.status && agendamento.status.toLowerCase() === requestedStatus
        );

        const enrichedAgendamentos = filteredAgendamentos.map(agendamento => {
            const cliente = clientes.find(c => String(c._id) === String(agendamento.clientId));
            const clienteNome = cliente ? cliente.name : 'Cliente Desconhecido';

            const procedimentosDetalhes = (agendamento.procedimentos || []).map(procAgendado => {
                const procedimentoOriginal = procedures.find(p => String(p._id) === String(procAgendado.id));
                const procNome = procedimentoOriginal ? procedimentoOriginal.nome : procAgendado.nome || 'Procedimento Desconhecido';
                return {
                    id: procAgendado.id,
                    nome: procNome,
                    valor: procAgendado.valor
                };
            });

            // Normaliza 'data' e 'hora' a partir de 'data'/'date' e 'hora'/'time'
            const dataOriginal = agendamento.data || agendamento.date;
            const horaOriginal = agendamento.hora || agendamento.time;

            const dataFormatada = dataOriginal ? new Date(dataOriginal).toLocaleDateString('pt-BR') : 'N/A';
            const horaFormatada = horaOriginal || 'N/A';

            return {
                ...agendamento, // Mantém todas as propriedades originais
                clienteNome: clienteNome,
                procedimentos: procedimentosDetalhes,
                data: dataFormatada, // Usa a data normalizada e formatada
                hora: horaFormatada, // Usa a hora normalizada
                valorTotal: parseFloat(agendamento.valorTotal || 0) // Garante que valorTotal é um número
            };
        });

        res.json(enrichedAgendamentos);

    } catch (error) {
        console.error(`Erro ao gerar relatório de agendamentos por status (${requestedStatus}):`, error);
        res.status(500).json({ message: `Erro ao carregar o relatório de agendamentos com status "${requestedStatus}".` });
    }
});

// Rotas de Transações (CRUD) - AGORA USANDO ASYNC/AWAIT
app.get('/api/transacoes', async (req, res) => {
    try {
        const transacoes = await readJsonFile(TRANSACOES_FILE);
        res.json(transacoes);
    } catch (error) {
        console.error('Erro na rota GET /api/transacoes:', error);
        res.status(500).json({ message: 'Erro ao carregar as transações.' });
    }
});

app.post('/api/transacoes', async (req, res) => {
    const novaTransacao = req.body;
    try {
        let transacoes = await readJsonFile(TRANSACOES_FILE);

        const lastId = transacoes.length > 0 ? Math.max(...transacoes.map(t => parseInt(t._id || 0))) : 0;
        novaTransacao._id = String(lastId + 1);

        novaTransacao.origem = novaTransacao.origem || "manual";
        novaTransacao.origemId = novaTransacao.origemId || null;
        novaTransacao.categoria = novaTransacao.categoria || "Outros";

        transacoes.push(novaTransacao);

        await writeJsonFile(TRANSACOES_FILE, transacoes);
        res.status(201).json({ message: 'Transação salva com sucesso!', transacao: novaTransacao });
    } catch (error) {
        console.error('Erro na rota POST /api/transacoes:', error);
        res.status(500).json({ message: 'Erro ao salvar a transação.' });
    }
});

app.put('/api/transacoes/:id', async (req, res) => {
    const transacaoIdToUpdate = req.params.id;
    const updatedTransacaoData = req.body;
    try {
        const transacoes = await readJsonFile(TRANSACOES_FILE);
        const transacaoIndex = transacoes.findIndex(t => t._id === transacaoIdToUpdate);
        if (transacaoIndex === -1) {
            return res.status(404).send('Transação não encontrada.');
        }
        transacoes[transacaoIndex] = { ...transacoes[transacaoIndex], ...updatedTransacaoData, _id: transacaoIdToUpdate };
        await writeJsonFile(TRANSACOES_FILE, transacoes);
        res.status(200).json({ message: 'Transação atualizada com sucesso!', transacao: transacoes[transacaoIndex] });
    } catch (error) {
        console.error('Erro na rota PUT /api/transacoes:', error);
        res.status(500).send('Erro ao atualizar a transação.');
    }
});

app.delete('/api/transacoes/:id', async (req, res) => {
    const transacaoIdToDelete = req.params.id;
    try {
        let transacoes = await readJsonFile(TRANSACOES_FILE);
        const initialLength = transacoes.length;
        transacoes = transacoes.filter(t => t._id !== transacaoIdToDelete);
        if (transacoes.length === initialLength) {
            return res.status(404).send('Transação não encontrada.');
        }
        await writeJsonFile(TRANSACOES_FILE, transacoes);
        res.status(200).json({ message: 'Transação excluída com sucesso!' });
    } catch (error) {
        console.error('Erro na rota DELETE /api/transacoes:', error);
        res.status(500).send('Erro ao excluir a transação.');
    }
});

// --- NOVAS ROTAS DE RELATÓRIOS DE AGENDAMENTOS POR PERÍODO (Dia, Semana, Mês) ---

app.get('/api/relatorios/agendamentos/:period', async (req, res) => {
    const periodType = req.params.period.toLowerCase(); // 'dia', 'semana', 'mes'
    const { date } = req.query; // Data de referência (ex: '2025-05-21')

    if (!date) {
        return res.status(400).json({ message: 'É necessário fornecer uma data de referência (parâmetro "date") para este relatório.' });
    }

    const referenceDate = new Date(date);
    if (isNaN(referenceDate.getTime())) {
        return res.status(400).json({ message: 'Data de referência inválida.' });
    }

    try {
        const agendamentos = await readJsonFile(AGENDAMENTOS_FILE);
        const clientes = await readJsonFile(CLIENTES_FILE);
        const procedures = await readJsonFile(PROCEDURES_FILE);

        let filteredAgendamentos = [];

        agendamentos.forEach(agendamento => {
            const agendamentoDateStr = agendamento.data || agendamento.date;
            if (!agendamentoDateStr) {
                console.warn(`Agendamento sem data/date ignorado: ${JSON.stringify(agendamento)}`);
                return;
            }
            const agendamentoDate = new Date(agendamentoDateStr);

            if (isNaN(agendamentoDate.getTime())) {
                console.warn(`Agendamento com data inválida ignorado: ${JSON.stringify(agendamento)}`);
                return;
            }

            let include = false;
            switch (periodType) {
                case 'dia':
                    include = isSameDay(agendamentoDate, referenceDate);
                    break;
                case 'semana':
                    include = isSameWeek(agendamentoDate, referenceDate);
                    break;
                case 'mes':
                    include = isSameMonth(agendamentoDate, referenceDate);
                    break;
                default:
                    // Caso um tipo de período não esperado seja enviado
                    break;
            }

            if (include) {
                filteredAgendamentos.push(agendamento);
            }
        });

        // Enriquecer os agendamentos filtrados com dados do cliente e procedimento
        const enrichedAgendamentos = filteredAgendamentos.map(agendamento => {
            const cliente = clientes.find(c => String(c._id) === String(agendamento.clientId));
            const clienteNome = cliente ? cliente.name : 'Cliente Desconhecido';

            const procedimentosDetalhes = (agendamento.procedimentos || []).map(procAgendado => {
                const procedimentoOriginal = procedures.find(p => String(p._id) === String(procAgendado.id));
                const procNome = procedimentoOriginal ? procedimentoOriginal.nome : procAgendado.nome || 'Procedimento Desconhecido';
                return {
                    id: procAgendado.id,
                    nome: procNome,
                    valor: procAgendado.valor
                };
            });

            const dataOriginal = agendamento.data || agendamento.date;
            const horaOriginal = agendamento.hora || agendamento.time;

            const dataFormatada = dataOriginal ? new Date(dataOriginal).toLocaleDateString('pt-BR') : 'N/A';
            const horaFormatada = horaOriginal || 'N/A';

            return {
                ...agendamento,
                clienteNome: clienteNome,
                procedimentos: procedimentosDetalhes,
                data: dataFormatada,
                hora: horaFormatada,
                valorTotal: parseFloat(agendamento.valorTotal || 0)
            };
        });

        res.json(enrichedAgendamentos);

    } catch (error) {
        console.error(`Erro ao gerar relatório de agendamentos por período (${periodType}):`, error);
        res.status(500).json({ message: `Erro ao carregar o relatório de agendamentos por "${periodType}".` });
    }
});



// NOVAS ROTAS PARA EDIÇÃO E PROCEDIMENTOS (Já usando ASYNC/AWAIT)

// Rota para buscar um agendamento específico pelo ID (para a tela de edição)
app.get('/api/agendamentos/:id', async (req, res) => {
    const agendamentoId = req.params.id;
    try {
        const agendamentos = await readJsonFile(AGENDAMENTOS_FILE);
        const agendamento = agendamentos.find(a => a._id === agendamentoId);
        if (agendamento) {
            res.json(agendamento);
        } else {
            res.status(404).json({ message: 'Agendamento não encontrado.' });
        }
    } catch (error) {
        console.error('Erro na rota GET /api/agendamentos/:id:', error);
        res.status(500).json({ message: 'Erro ao carregar agendamento.' });
    }
});

// Rota para buscar procedimentos (para a tela de edição, dropdown de procedimentos)
app.get('/api/procedures', async (req, res) => {
    try {
        const procedures = await readJsonFile(PROCEDURES_FILE);
        res.json(procedures);
    } catch (error) {
        console.error('Erro na rota GET /api/procedures:', error);
        res.status(500).json({ message: 'Erro ao carregar procedimentos.' });
    }
});


// Rota para buscar clientes (para a tela de edição, dropdown de clientes)
app.get('/api/clients-dropdown', async (req, res) => {
    try {
        const clientes = await readJsonFile(CLIENTES_FILE);
        // Retorna apenas o _id e o nome para o dropdown, otimizando a resposta
        res.json(clientes.map(c => ({ _id: c._id, name: c.name })));
    } catch (error) {
        console.error('Erro na rota GET /api/clients-dropdown:', error);
        res.status(500).json({ message: 'Erro ao carregar clientes para dropdown.' });
    }
});


// Rota para relatórios (Exemplo: Total de receitas e despesas por período)
app.get('/api/reports/financial', async (req, res) => {
    const { period } = req.query; // 'day', 'week', 'month', 'total'
    try {
        const transacoes = await readJsonFile(TRANSACOES_FILE);
        const now = new Date();
        let receitas = 0;
        let despesas = 0;

        transacoes.forEach(transacao => {
            const transacaoDate = new Date(transacao.data); // Assumindo que transacao.data é um formato de data válido

            let includeTransaction = false;
            if (period === 'day' && isSameDay(transacaoDate, now)) {
                includeTransaction = true;
            } else if (period === 'week' && isSameWeek(transacaoDate, now)) {
                includeTransaction = true;
            } else if (period === 'month' && isSameMonth(transacaoDate, now)) {
                includeTransaction = true;
            } else if (period === 'total') {
                includeTransaction = true;
            }

            if (includeTransaction) {
                if (transacao.tipo === 'receita') {
                    receitas += parseFloat(transacao.valor || 0);
                } else if (transacao.tipo === 'despesa') {
                    despesas += parseFloat(transacao.valor || 0);
                }
            }
        });

        res.json({ receitas: receitas.toFixed(2), despesas: despesas.toFixed(2) });

    } catch (error) {
        console.error('Erro ao gerar relatório financeiro:', error);
        res.status(500).json({ message: 'Erro ao gerar relatório financeiro.' });
    }
});


app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
    console.log(`Acesse o frontend em http://localhost:${port}/dashboard.html (assumindo que dashboard.html está na pasta raiz do projeto)`);
});