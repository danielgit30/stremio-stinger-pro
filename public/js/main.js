let currentHttpsUrl = '';

function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('apiKey');
    const eyeIcon = document.getElementById('eyeIcon');
    const toggleBtn = document.getElementById('toggleApiKeyBtn');

    eyeIcon.innerHTML = '';
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleBtn.setAttribute('title', 'Hide API Key');
        toggleBtn.setAttribute('aria-label', 'Hide API Key');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute(
            'd',
            'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'
        );
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '1');
        line.setAttribute('y1', '1');
        line.setAttribute('x2', '23');
        line.setAttribute('y2', '23');
        eyeIcon.appendChild(path);
        eyeIcon.appendChild(line);
    } else {
        apiKeyInput.type = 'password';
        toggleBtn.setAttribute('title', 'Show API Key');
        toggleBtn.setAttribute('aria-label', 'Show API Key');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '3');
        eyeIcon.appendChild(path);
        eyeIcon.appendChild(circle);
    }
}

function updatePreview() {
    const style = document.getElementById('displayStyle').value;
    const configShowSource = document.getElementById('showSource').checked;
    const configShowBloopers = document.getElementById('showBloopers').checked;
    const configShowSequel = document.getElementById('showSequel').checked;

    document.getElementById('testBloopersContainer').style.display = configShowBloopers ? 'flex' : 'none';
    document.getElementById('testSequelContainer').style.display = configShowSequel ? 'flex' : 'none';

    const isWiki = document.getElementById('testWiki').checked;
    const isMid = document.getElementById('testMid').checked;
    const isPost = document.getElementById('testPost').checked;
    const isBloopers = document.getElementById('testBloopers').checked;
    const isSequel = document.getElementById('testSequel').checked;

    const previewText = document.getElementById('streamPreviewText');
    let lines = [];

    if (isWiki && !isMid && !isPost) {
        if (style === 'simple') lines.push('Unclassified');
        else if (style === 'monochrome') lines.push('⚠ Unclassified Scene');
        else lines.push('❓ Unclassified Scene');
    } else {
        if (isMid && isPost) {
            if (style === 'simple') {
                lines.push('Mid & Post');
            } else if (style === 'monochrome') {
                lines.push('⤹⤷ Mid & Post-Credits Scenes');
            } else {
                lines.push('🍿 Mid & Post-Credits Scenes');
            }
        } else if (isMid) {
            if (style === 'simple') lines.push('Mid Only');
            else if (style === 'monochrome') lines.push('⤷ Mid-Credits Scene');
            else lines.push('⏳ Mid-Credits Scene');
        } else if (isPost) {
            if (style === 'simple') lines.push('Post Only');
            else if (style === 'monochrome') lines.push('⤵︎ Post-Credits Scene');
            else lines.push('🎬 Post-Credits Scene');
        } else if (!isBloopers || !configShowBloopers) {
            if (style === 'simple') lines.push('None');
            else if (style === 'monochrome') lines.push('𐦂 Nothing But Credits');
            else lines.push('🏃‍♂️ Nothing But Credits');
        }
    }

    if (configShowBloopers && isBloopers) {
        if (style === 'simple') lines.push('Outtakes');
        else if (style === 'monochrome') lines.push('☄ Outtakes');
        else lines.push('🎭 Outtakes');
    }

    if (configShowSequel && isSequel) {
        if (style === 'simple') lines.push('Sequel Setup');
        else if (style === 'monochrome') lines.push('📽 Sets Up For A Sequel');
        else lines.push('🔮 Sets Up For A Sequel');
    }

    if (configShowSource) {
        let mockSource = isWiki
            ? 'Wikipedia'
            : isMid || isPost || isBloopers || isSequel
                ? 'AfterCredits'
                : 'Aggregated';
        lines.push(`Source: ${mockSource}`);
    }

    previewText.textContent = '';
    lines.forEach((line, index) => {
        previewText.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
            previewText.appendChild(document.createElement('br'));
        }
    });
}

function validateApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    const key = apiKeyInput.value.trim();
    const errorSpan = document.getElementById('apiKeyError');

    if (key === '') {
        errorSpan.style.display = 'none';
        apiKeyInput.style.borderColor = '';
        apiKeyInput.setAttribute('aria-invalid', 'false');
        return true;
    }

    const isValid = /^[a-f0-9]{32}$/i.test(key);
    if (isValid) {
        errorSpan.style.display = 'none';
        apiKeyInput.style.borderColor = 'var(--success-color)';
        apiKeyInput.setAttribute('aria-invalid', 'false');
        return true;
    } else {
        errorSpan.style.display = 'block';
        apiKeyInput.style.borderColor = 'var(--danger-color)';
        apiKeyInput.setAttribute('aria-invalid', 'true');
        return false;
    }
}

function installAddon() {
    if (!validateApiKey()) {
        document.getElementById('apiKey').focus();
        return;
    }
    const key = document.getElementById('apiKey').value.trim();
    let style = document.getElementById('displayStyle').value;

    if (!document.getElementById('showSource').checked) style += '-nosource';
    if (document.getElementById('showBloopers').checked) style += '-bloopers';
    if (document.getElementById('showSequel').checked) style += '-sequel';

    const host = window.location.host;
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const httpProtocol = isLocal ? 'http://' : 'https://';

    let pathParts = ['', style];
    if (key) pathParts.push(encodeURIComponent(key));
    pathParts.push('manifest.json');

    const path = pathParts.join('/');
    const stremioUrl = `stremio://${host}${path}`;
    currentHttpsUrl = `${httpProtocol}${host}${path}`;

    document.getElementById('result-container').style.display = 'block';
    document.getElementById('install-link').innerText = currentHttpsUrl;

    window.location.href = stremioUrl;
}

function copyLink() {
    const copyBtn = document.querySelector('.copy-btn');
    navigator.clipboard.writeText(currentHttpsUrl).then(() => {
        const ogText = copyBtn.innerText;
        copyBtn.innerText = 'Copied! ✓';
        setTimeout(() => (copyBtn.innerText = ogText), 2000);
    });
}

function initCustomSelect() {
    const container = document.querySelector('.custom-select-container');
    const trigger = document.getElementById('customSelectTrigger');
    const options = document.querySelectorAll('.custom-option');
    const hiddenSelect = document.getElementById('displayStyle');
    const selectValueSpan = document.getElementById('customSelectValue');

    if (!container || !trigger || !hiddenSelect) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = container.classList.contains('open');
        container.classList.toggle('open');
        trigger.setAttribute('aria-expanded', !isOpen);
    });

    options.forEach((option) => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = option.getAttribute('data-value');
            const text = option.textContent;

            options.forEach((opt) => opt.classList.remove('selected'));
            option.classList.add('selected');

            selectValueSpan.textContent = text;
            hiddenSelect.value = value;
            updatePreview();

            container.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        });
    });

    document.addEventListener('click', () => {
        container.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
    });
}

window.onload = () => {
    initCustomSelect();
    updatePreview();

    // Attach event listeners dynamically
    const installForm = document.getElementById('installForm');
    if (installForm) {
        installForm.addEventListener('submit', (event) => {
            event.preventDefault();
            installAddon();
        });
    }

    const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
    if (toggleApiKeyBtn) {
        toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
    }

    const apiKeyInput = document.getElementById('apiKey');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', validateApiKey);
    }

    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyLink);
    }

    // Attach updatePreview to all checkboxes
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', updatePreview);
    });
};
