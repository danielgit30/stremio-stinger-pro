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
    const configShowRelated = document.getElementById('showRelated').checked;

    document.getElementById('testBloopersContainer').style.display = configShowBloopers ? 'flex' : 'none';
    document.getElementById('testSequelContainer').style.display = configShowSequel ? 'flex' : 'none';
    document.getElementById('testRelatedContainer').style.display = configShowRelated ? 'flex' : 'none';

    const isWiki = document.getElementById('testWiki').checked;
    const isMid = document.getElementById('testMid').checked;
    const isPost = document.getElementById('testPost').checked;
    const isBloopers = document.getElementById('testBloopers').checked;
    const isSequel = document.getElementById('testSequel').checked;
    const isRelated = document.getElementById('testRelated').checked;

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
        else if (style === 'monochrome') lines.push('⛶ Sets Up For A Sequel');
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

    const relatedBox = document.getElementById('streamPreviewRelatedBox');
    const relatedText = document.getElementById('streamPreviewRelatedText');
    if (configShowRelated && isRelated) {
        relatedBox.style.display = 'block';
        relatedText.textContent = '';
        if (style === 'simple') {
            relatedText.appendChild(document.createTextNode('Based on Iron Man (1968) (Comic)'));
            relatedText.appendChild(document.createElement('br'));
            relatedText.appendChild(document.createTextNode('Prequel: Incredible Hulk (2008)'));
            relatedText.appendChild(document.createElement('br'));
            relatedText.appendChild(document.createTextNode('Sequel: Thor (2011)'));
        } else if (style === 'monochrome') {
            relatedText.appendChild(document.createTextNode('✐ Based on Iron Man (1968) (Comic)'));
            relatedText.appendChild(document.createElement('br'));
            relatedText.appendChild(document.createTextNode('◂ Incredible Hulk (2008)'));
            relatedText.appendChild(document.createElement('br'));
            relatedText.appendChild(document.createTextNode('▸ Thor (2011)'));
        } else {
            relatedText.appendChild(document.createTextNode('📖 Based on Iron Man (1968) (Comic)'));
            relatedText.appendChild(document.createElement('br'));
            relatedText.appendChild(document.createTextNode('⏪ Incredible Hulk (2008)'));
            relatedText.appendChild(document.createElement('br'));
            relatedText.appendChild(document.createTextNode('⏩ Thor (2011)'));
        }
    } else {
        relatedBox.style.display = 'none';
    }
    saveConfigToLocalStorage();
}

function validateApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    const key = apiKeyInput.value.trim();
    const errorSpan = document.getElementById('apiKeyError');

    let result;
    if (key === '') {
        errorSpan.style.display = 'none';
        apiKeyInput.style.borderColor = '';
        apiKeyInput.setAttribute('aria-invalid', 'false');
        result = true;
    } else {
        const isValid = /^[a-f0-9]{32}$/i.test(key);
        if (isValid) {
            errorSpan.style.display = 'none';
            apiKeyInput.style.borderColor = 'var(--success-color)';
            apiKeyInput.setAttribute('aria-invalid', 'false');
            result = true;
        } else {
            errorSpan.style.display = 'block';
            apiKeyInput.style.borderColor = 'var(--danger-color)';
            apiKeyInput.setAttribute('aria-invalid', 'true');
            result = false;
        }
    }
    saveConfigToLocalStorage();
    return result;
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
    if (document.getElementById('showRelated').checked) style += '-related';

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
    if (!currentHttpsUrl) return;

    // navigator.clipboard is available in all modern browsers over HTTPS.
    // The execCommand('copy') API is deprecated and removed in modern engines —
    // we fall back to a user-visible prompt instead of a silently broken dead code path.
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
            .writeText(currentHttpsUrl)
            .then(() => {
                const ogText = copyBtn.innerText;
                copyBtn.innerText = 'Copied! ✓';
                setTimeout(() => (copyBtn.innerText = ogText), 2000);
            })
            .catch(() => {
                // Clipboard write was blocked (e.g., permissions denied); surface the URL to the user.
                window.prompt('Copy the URL below:', currentHttpsUrl);
            });
    } else {
        // Non-HTTPS or very old browser: surface the URL directly.
        window.prompt('Copy the URL below:', currentHttpsUrl);
    }
}

function initCustomSelect() {
    const container = document.querySelector('.custom-select-container');
    const trigger = document.getElementById('customSelectTrigger');
    const options = document.querySelectorAll('.custom-option');
    const hiddenSelect = document.getElementById('displayStyle');
    const selectValueSpan = document.getElementById('customSelectValue');

    if (!container || !trigger || !hiddenSelect) return;

    let focusedOptionIndex = -1;

    const openDropdown = () => {
        container.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        focusedOptionIndex = Array.from(options).findIndex((opt) => opt.classList.contains('selected'));
        if (focusedOptionIndex === -1) focusedOptionIndex = 0;
        options[focusedOptionIndex].focus();
    };

    const closeDropdown = () => {
        container.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        focusedOptionIndex = -1;
    };

    const selectOption = (index) => {
        const option = options[index];
        const value = option.getAttribute('data-value');
        const text = option.textContent;

        options.forEach((opt) => opt.classList.remove('selected'));
        option.classList.add('selected');

        selectValueSpan.textContent = text;
        hiddenSelect.value = value;
        updatePreview();

        closeDropdown();
        trigger.focus();
    };

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = container.classList.contains('open');
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    options.forEach((option, index) => {
        option.setAttribute('tabindex', '-1');
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            selectOption(index);
        });

        option.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusedOptionIndex = (index + 1) % options.length;
                options[focusedOptionIndex].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedOptionIndex = (index - 1 + options.length) % options.length;
                options[focusedOptionIndex].focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectOption(index);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDropdown();
                trigger.focus();
            } else if (e.key === 'Tab') {
                closeDropdown();
            }
        });
    });

    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDropdown();
        }
    });

    document.addEventListener('click', () => {
        closeDropdown();
    });
}

function saveConfigToLocalStorage() {
    try {
        const key = document.getElementById('apiKey')?.value.trim() || '';
        const style = document.getElementById('displayStyle')?.value || 'colorful';
        const showSource = document.getElementById('showSource')?.checked ?? true;
        const showBloopers = document.getElementById('showBloopers')?.checked ?? false;
        const showSequel = document.getElementById('showSequel')?.checked ?? false;
        const showRelated = document.getElementById('showRelated')?.checked ?? false;

        localStorage.setItem('stinger_apiKey', key);
        localStorage.setItem('stinger_style', style);
        localStorage.setItem('stinger_showSource', showSource);
        localStorage.setItem('stinger_showBloopers', showBloopers);
        localStorage.setItem('stinger_showSequel', showSequel);
        localStorage.setItem('stinger_showRelated', showRelated);
    } catch (e) {
        console.warn('Failed to save configuration to localStorage:', e);
    }
}

function loadConfigFromLocalStorage() {
    try {
        const key = localStorage.getItem('stinger_apiKey');
        const style = localStorage.getItem('stinger_style');
        const showSource = localStorage.getItem('stinger_showSource');
        const showBloopers = localStorage.getItem('stinger_showBloopers');
        const showSequel = localStorage.getItem('stinger_showSequel');
        const showRelated = localStorage.getItem('stinger_showRelated');

        const apiKeyInput = document.getElementById('apiKey');
        if (apiKeyInput && key !== null) {
            apiKeyInput.value = key;
        }

        const hiddenSelect = document.getElementById('displayStyle');
        if (hiddenSelect && style !== null) {
            hiddenSelect.value = style;
            const selectValueSpan = document.getElementById('customSelectValue');
            if (selectValueSpan) {
                const displayNames = {
                    colorful: 'Colorful',
                    monochrome: 'Monochrome',
                    simple: 'Simple',
                };
                selectValueSpan.textContent = displayNames[style] || 'Colorful';
            }
            const options = document.querySelectorAll('.custom-option');
            options.forEach((option) => {
                if (option.getAttribute('data-value') === style) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            });
        }

        if (showSource !== null) {
            const checkbox = document.getElementById('showSource');
            if (checkbox) checkbox.checked = showSource === 'true';
        }
        if (showBloopers !== null) {
            const checkbox = document.getElementById('showBloopers');
            if (checkbox) checkbox.checked = showBloopers === 'true';
        }
        if (showSequel !== null) {
            const checkbox = document.getElementById('showSequel');
            if (checkbox) checkbox.checked = showSequel === 'true';
        }
        if (showRelated !== null) {
            const checkbox = document.getElementById('showRelated');
            if (checkbox) checkbox.checked = showRelated === 'true';
        }
    } catch (e) {
        console.warn('Failed to load configuration from localStorage:', e);
    }
}

window.onload = () => {
    initCustomSelect();
    loadConfigFromLocalStorage();
    validateApiKey();
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
