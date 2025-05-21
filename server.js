const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors()); // Habilite o CORS para todas as origens (para desenvolvimento)

// Servir arquivos estáticos (HTML, CSS, JS) da mesma pasta
app.use(express.static(path.join(__dirname)));

// Conexão com o MongoDB
mongoose.connect('mongodb://localhost:27017/test')
    .then(() => console.log('Conectado ao MongoDB'))
    .catch(err => console.error('Erro ao conectar ao MongoDB', err));

// Definição do Schema de Usuário
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
});
const User = mongoose.model('User', UserSchema);

// Definição do Schema de Cliente
const ClientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String }
});
const Client = mongoose.model('Client', ClientSchema, 'clients');

// ---------------------------------------------------------------------
// NOVOS SCHEMAS E ROTAS PARA SERVIÇOS E AGENDAMENTOS
// ---------------------------------------------------------------------

// Definição do Schema de Serviço
const ServiceSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true, min: 0 }
});
const Service = mongoose.model('Service', ServiceSchema, 'services'); // 'services' é o nome da coleção

// Definição do Schema de Agendamento
const AppointmentSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true }, // Ex: "10:00"
    status: { type: String, enum: ['pendente', 'confirmado', 'cancelado'], default: 'pendente' }
});
const Appointment = mongoose.model('Appointment', AppointmentSchema, 'appointments'); // 'appointments' é o nome da coleção

// ---------------------------------------------------------------------
// ROTAS PARA SERVIÇOS
// ---------------------------------------------------------------------

// Rota para listar todos os serviços
app.get('/api/services', async (req, res) => {
    try {
        const services = await Service.find();
        res.status(200).json(services);
    } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        res.status(500).json({ message: 'Erro ao buscar a lista de serviços.' });
    }
});

// Rota para adicionar um novo serviço
app.post('/api/services', async (req, res) => {
    try {
        const newService = new Service(req.body);
        const savedService = await newService.save();
        res.status(201).json(savedService);
    } catch (error) {
        console.error('Erro ao adicionar serviço:', error);
        res.status(500).json({ message: 'Erro ao salvar o serviço.' });
    }
});

// ---------------------------------------------------------------------
// ROTAS PARA AGENDAMENTOS
// ---------------------------------------------------------------------

// Rota para adicionar um novo agendamento
app.post('/api/appointments', async (req, res) => {
    try {
        const newAppointment = new Appointment(req.body);
        const savedAppointment = await newAppointment.save();
        res.status(201).json(savedAppointment);
    } catch (error) {
        console.error('Erro ao adicionar agendamento:', error);
        res.status(500).json({ message: 'Erro ao salvar o agendamento.' });
    }
});

// Rota para listar TODOS os agendamentos (pode ser usado para "Consultar Agendamentos")
app.get('/api/appointments', async (req, res) => {
    try {
        // Usamos .populate() para trazer os dados completos do cliente e do serviço
        const appointments = await Appointment.find()
            .populate('clientId', 'name phone email') // Popula o campo 'clientId', trazendo 'name', 'phone', 'email' do cliente
            .populate('serviceId', 'name price'); // Popula o campo 'serviceId', trazendo 'name', 'price' do serviço
        res.status(200).json(appointments);
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        res.status(500).json({ message: 'Erro ao buscar a lista de agendamentos.' });
    }
});


// Rota para buscar um agendamento por ID (se precisar editar um agendamento específico)
app.get('/api/appointments/:id', async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('clientId', 'name phone email')
            .populate('serviceId', 'name price');
        if (!appointment) {
            return res.status(404).json({ message: 'Agendamento não encontrado.' });
        }
        res.status(200).json(appointment);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ message: 'Formato de ID inválido.' });
        }
        console.error('Erro ao buscar agendamento por ID:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar agendamento.' });
    }
});

// Rota para atualizar um agendamento
app.put('/api/appointments/:id', async (req, res) => {
    try {
        const updatedAppointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedAppointment) {
            return res.status(404).json({ message: 'Agendamento não encontrado.' });
        }
        res.status(200).json(updatedAppointment);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ message: 'Formato de ID inválido para atualização.' });
        }
        console.error('Erro ao atualizar agendamento:', error);
        res.status(500).json({ message: 'Erro ao atualizar o agendamento.' });
    }
});

// Rota para excluir um agendamento
app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const deletedAppointment = await Appointment.findByIdAndDelete(req.params.id);
        if (!deletedAppointment) {
            return res.status(404).json({ message: 'Agendamento não encontrado.' });
        }
        res.status(204).send(); // 204 No Content para exclusão bem-sucedida
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ message: 'Formato de ID inválido para exclusão.' });
        }
        console.error('Erro ao excluir agendamento:', error);
        res.status(500).json({ message: 'Erro ao excluir o agendamento.' });
    }
});


// ---------------------------------------------------------------------
// ROTAS DE RELATÓRIO DE AGENDAMENTOS (PARA relatorios.js)
// ---------------------------------------------------------------------

// Rota para buscar agendamentos por status (pendentes, confirmados, cancelados)
app.get('/api/relatorios/status/:status', async (req, res) => {
    const status = req.params.status;
    if (!['pendentes', 'confirmados', 'cancelados'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido.' });
    }
    try {
        const appointments = await Appointment.find({ status: status })
            .populate('clientId', 'name') // Popula apenas o nome do cliente
            .populate('serviceId', 'name'); // Popula apenas o nome do serviço
        res.status(200).json(appointments);
    } catch (error) {
        console.error(`Erro ao buscar agendamentos ${status}:`, error);
        res.status(500).json({ message: `Erro ao buscar agendamentos ${status}.` });
    }
});

// Rota para relatórios diários, semanais, mensais
app.get('/api/relatorios/agendamentos/:tipo', async (req, res) => {
    const tipo = req.params.tipo; // 'dia', 'semana', 'mes'
    const dateStr = req.query.data; // Data de referência vinda do frontend (YYYY-MM-DD)

    if (!dateStr) {
        return res.status(400).json({ message: 'Data de referência é obrigatória para relatórios por período.' });
    }

    const startOfDay = new Date(dateStr + 'T00:00:00.000Z'); // Define o início do dia em UTC
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z');   // Define o final do dia em UTC

    let query = {};
    let startDate, endDate;

    switch (tipo) {
        case 'dia':
            startDate = startOfDay;
            endDate = endOfDay;
            break;
        case 'semana':
            // Assume que a semana começa no domingo (0)
            const dayOfWeek = startOfDay.getUTCDay(); // 0 para Domingo, 1 para Segunda...
            startDate = new Date(startOfDay);
            startDate.setUTCDate(startOfDay.getUTCDate() - dayOfWeek); // Volta para o domingo da semana
            startDate.setUTCHours(0, 0, 0, 0);

            endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + 6); // Vai até o sábado
            endDate.setUTCHours(23, 59, 59, 999);
            break;
        case 'mes':
            startDate = new Date(Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1, 0, 0, 0, 0));
            endDate = new Date(Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth() + 1, 0, 23, 59, 59, 999)); // Último dia do mês
            break;
        default:
            return res.status(400).json({ message: 'Tipo de relatório por período inválido.' });
    }

    query.date = { $gte: startDate, $lte: endDate };

    try {
        const appointments = await Appointment.find(query)
            .populate('clientId', 'name')
            .populate('serviceId', 'name');
        res.status(200).json(appointments);
    } catch (error) {
        console.error(`Erro ao buscar relatório ${tipo}:`, error);
        res.status(500).json({ message: `Erro ao buscar relatório ${tipo}.` });
    }
});


// ---------------------------------------------------------------------
// ROTAS PARA CLIENTES (mantidas)
// ---------------------------------------------------------------------

// Rota para listar todos os clientes
app.get('/api/clients', async (req, res) => {
    try {
        const clients = await Client.find();
        res.status(200).json(clients);
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({ message: 'Erro ao buscar a lista de clientes.' });
    }
});

// Rota para buscar um cliente por ID
app.get('/api/clients/:id', async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        res.status(200).json(client);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ message: 'Formato de ID inválido.' });
        }
        console.error('Erro ao buscar cliente por ID:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar cliente.' });
    }
});

// Rota para adicionar um novo cliente
app.post('/api/clients', async (req, res) => {
    try {
        const newClient = new Client(req.body);
        const savedClient = await newClient.save();
        res.status(201).json(savedClient);
    } catch (error) {
        console.error('Erro ao adicionar cliente:', error);
        res.status(500).json({ message: 'Erro ao salvar o cliente.' });
    }
});

// Rota para atualizar um cliente existente
app.put('/api/clients/:id', async (req, res) => {
    try {
        const updatedClient = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedClient) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        res.status(200).json(updatedClient);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ message: 'Formato de ID inválido para atualização.' });
        }
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).json({ message: 'Erro ao atualizar o cliente.' });
    }
});

// Rota para excluir um cliente
app.delete('/api/clients/:id', async (req, res) => {
    try {
        const deletedClient = await Client.findByIdAndDelete(req.params.id);
        if (!deletedClient) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        res.status(204).send(); // 204 No Content para exclusão bem-sucedida
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ message: 'Formato de ID inválido para exclusão.' });
        }
        console.error('Erro ao excluir cliente:', error);
        res.status(500).json({ message: 'Erro ao excluir o cliente.' });
    }
});

// ---------------------------------------------------------------------
// ROTAS PARA AUTENTICAÇÃO (Registro e Login) (mantidas)
// ---------------------------------------------------------------------

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Nome de usuário ou email já cadastrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'Usuário registrado com sucesso.' });

    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao registrar.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        res.status(200).json({ message: 'Login realizado com sucesso.' });

    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao fazer login.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});