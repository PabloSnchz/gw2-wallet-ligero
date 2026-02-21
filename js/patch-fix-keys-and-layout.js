// Improved script to use an inline expandable form for API key input

let apiForm;

function createApiKeyForm() {
    apiForm = document.createElement('div');
    apiForm.innerHTML = `
        <div>
            <input type='text' id='keyName' placeholder='Key Name' />
            <input type='text' id='apiKey' placeholder='API Key' />
            <button id='saveKey'>Guardar</button>
            <button id='cancel'>Cancelar</button>
        </div>
    `;
    document.body.appendChild(apiForm);

    // Event listeners for buttons
    document.getElementById('saveKey').addEventListener('click', saveApiKey);
    document.getElementById('cancel').addEventListener('click', cancelApiKeyInput);
}

function saveApiKey() {
    const keyName = document.getElementById('keyName').value;
    const apiKey = document.getElementById('apiKey').value;

    if (!validateApiKey(apiKey)) {
        alert('Invalid API key');
        return;
    }

    const keys = JSON.parse(localStorage.getItem('apiKeys')) || {};
    keys[keyName] = apiKey;
    localStorage.setItem('apiKeys', JSON.stringify(keys));
    alert('API Key saved!');
    autoSelectKey(keyName);
    apiForm.remove();
}

function validateApiKey(key) {
    // Replace with actual validation logic
    return key.length > 0;
}

function cancelApiKeyInput() {
    apiForm.remove();
}

function autoSelectKey(keyName) {
    // Logic to auto-select the saved key, could depend on the rest of your app
    console.log('Selected key:', keyName);
}

// Call the function to create the form when needed
createApiKeyForm();
