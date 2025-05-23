// userManagement.js
document.addEventListener('DOMContentLoaded', () => {
    fetchUsers(); // Chama a função para carregar os usuários quando a página carrega
});

async function fetchUsers() {
    try {
        const response = await fetch('http://localhost:3001/api/users'); // Sua nova rota
        if (!response.ok) {
            // Lida com respostas HTTP que indicam erro (ex: 404, 500)
            const errorData = await response.json();
            throw new Error(errorData.message || `Erro HTTP! Status: ${response.status}`);
        }
        const users = await response.json();
        console.log('Usuários recebidos:', users); // Para depuração
        displayUsers(users); // Chama a função para exibir os usuários na tabela
    } catch (error) {
        console.error('Falha ao buscar usuários:', error);
        // Exiba uma mensagem de erro amigável para o usuário
        const userListContainer = document.getElementById('userListContainer');
        if (userListContainer) {
            userListContainer.innerHTML = '<p>Erro ao carregar os usuários. Por favor, tente novamente mais tarde.</p>';
        }
    }
}

function displayUsers(users) {
    const usersTableBody = document.getElementById('usersTableBody');
    if (!usersTableBody) {
        console.error("Elemento 'usersTableBody' não encontrado.");
        return;
    }

    usersTableBody.innerHTML = ''; // Limpa qualquer conteúdo anterior

    if (users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="2">Nenhum usuário cadastrado.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = usersTableBody.insertRow();
        const usernameCell = row.insertCell();
        const emailCell = row.insertCell();

        usernameCell.textContent = user.username;
        emailCell.textContent = user.email;
        // Adicione mais células aqui se você tiver mais dados para mostrar
    });
}