let currentHttpsUrl = '';
let activeTestData = null;

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

    let isWiki, isMid, isPost, isBloopers, isSequel, isRelated, isAudioOnly, actualSource;

    const testMidCb = document.getElementById('testMid');
    const testPostCb = document.getElementById('testPost');
    const testWikiCb = document.getElementById('testWiki');

    if (activeTestData) {
        testMidCb.disabled = true;
        testPostCb.disabled = true;
        testWikiCb.disabled = true;

        isMid = activeTestData.mid;
        isPost = activeTestData.post;
        isWiki = activeTestData.source ? activeTestData.source.includes('Wikipedia') : false;
        isBloopers = activeTestData.bloopers && document.getElementById('testBloopers').checked;
        isSequel = activeTestData.sequel && document.getElementById('testSequel').checked;
        isRelated = !!activeTestData.relatedData && document.getElementById('testRelated').checked;
        isAudioOnly = activeTestData.audioOnly;
        actualSource = activeTestData.source;
    } else {
        testMidCb.disabled = false;
        testPostCb.disabled = false;
        testWikiCb.disabled = false;

        isMid = testMidCb.checked;
        isPost = testPostCb.checked;
        isWiki = testWikiCb.checked;
        isBloopers = document.getElementById('testBloopers').checked;
        isSequel = document.getElementById('testSequel').checked;
        isRelated = document.getElementById('testRelated').checked;
        isAudioOnly = false;
        actualSource = isWiki ? 'Wikipedia' : isMid || isPost || isBloopers || isSequel ? 'AfterCredits' : 'Aggregated';
    }

    const previewText = document.getElementById('streamPreviewText');
    let lines = [];

    if (isWiki && !isMid && !isPost && !isBloopers) {
        if (style === 'simple') lines.push('Unclassified');
        else if (style === 'monochrome') lines.push('⚠ Unclassified Scene');
        else lines.push('❓ Unclassified Scene');
    } else {
        if (isMid && isPost) {
            if (style === 'simple') {
                lines.push(isAudioOnly ? 'Mid & Post (Audio)' : 'Mid & Post');
            } else if (style === 'monochrome') {
                lines.push(isAudioOnly ? '⤹⤷ Mid & Post-Credits Scenes (Audio Only)' : '⤹⤷ Mid & Post-Credits Scenes');
            } else {
                lines.push(isAudioOnly ? '🍿 Mid & Post-Credits Scenes (Audio Only)' : '🍿 Mid & Post-Credits Scenes');
            }
        } else if (isMid) {
            if (style === 'simple') lines.push(isAudioOnly ? 'Mid Audio' : 'Mid Only');
            else if (style === 'monochrome')
                lines.push(isAudioOnly ? '🕪 Mid-Credits Audio Cue' : '⤷ Mid-Credits Scene');
            else lines.push(isAudioOnly ? '🔊 Mid-Credits Audio Cue' : '⏳ Mid-Credits Scene');
        } else if (isPost) {
            if (style === 'simple') lines.push(isAudioOnly ? 'Post Audio' : 'Post Only');
            else if (style === 'monochrome')
                lines.push(isAudioOnly ? '🕪 Post-Credits Audio Cue' : '⤵︎ Post-Credits Scene');
            else lines.push(isAudioOnly ? '🔊 Post-Credits Audio Cue' : '🎬 Post-Credits Scene');
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

    if (configShowSequel && isSequel && (!activeTestData || actualSource.includes('AfterCredits'))) {
        if (style === 'simple') lines.push('Sequel Setup');
        else if (style === 'monochrome') lines.push('⛶ Sets Up For A Sequel');
        else lines.push('🔮 Sets Up For A Sequel');
    }

    if (configShowSource) {
        lines.push(`Source: ${actualSource}`);
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
        relatedBox.style.display = 'flex';
        relatedText.textContent = '';

        let prequelStr = '';
        let sequelStr = '';
        let sourceMaterial = '';
        let collectionName = '';

        if (activeTestData && activeTestData.relatedData) {
            const rData = activeTestData.relatedData;
            collectionName = rData.collectionName || '';
            sourceMaterial = rData.sourceMaterial || '';
            if (rData.prequel) {
                prequelStr = `${rData.prequel.title} (${rData.prequel.release_date ? rData.prequel.release_date.split('-')[0] : 'N/A'})`;
            }
            if (rData.sequel) {
                sequelStr = `${rData.sequel.title} (${rData.sequel.release_date ? rData.sequel.release_date.split('-')[0] : 'N/A'})`;
            }
        } else {
            collectionName = 'Marvel Cinematic Universe (MCU)';
            sourceMaterial = 'Iron Man (1968) (Comic)';
            prequelStr = 'Incredible Hulk (2008)';
            sequelStr = 'Thor (2011)';
        }

        const relatedTitleSpan = document.getElementById('streamPreviewRelatedTitle');
        if (relatedTitleSpan) {
            relatedTitleSpan.textContent = collectionName ? `Part of ${collectionName}` : 'Extended Metadata';
        }

        let rLines = [];
        if (style === 'simple') {
            if (sourceMaterial) rLines.push(`Based on ${sourceMaterial}`);
            if (prequelStr) rLines.push(`Prequel: ${prequelStr}`);
            if (sequelStr) rLines.push(`Sequel: ${sequelStr}`);
        } else if (style === 'monochrome') {
            if (sourceMaterial) rLines.push(`✐ Based on ${sourceMaterial}`);
            if (prequelStr) rLines.push(`◂ ${prequelStr}`);
            if (sequelStr) rLines.push(`▸ ${sequelStr}`);
        } else {
            if (sourceMaterial) rLines.push(`📖 Based on ${sourceMaterial}`);
            if (prequelStr) rLines.push(`⏪ ${prequelStr}`);
            if (sequelStr) rLines.push(`⏩ ${sequelStr}`);
        }

        rLines.forEach((line, index) => {
            relatedText.appendChild(document.createTextNode(line));
            if (index < rLines.length - 1) {
                relatedText.appendChild(document.createElement('br'));
            }
        });
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

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
            .writeText(currentHttpsUrl)
            .then(() => {
                const ogText = copyBtn.innerText;
                copyBtn.innerText = 'Copied! ✓';
                setTimeout(() => (copyBtn.innerText = ogText), 2000);
            })
            .catch(() => {
                window.prompt('Copy the URL below:', currentHttpsUrl);
            });
    } else {
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

function initTestLookup() {
    const btnLookup = document.getElementById('btnTestLookup');
    const inputQuery = document.getElementById('movieNameInput');
    const statusDiv = document.getElementById('lookupStatus');

    if (!btnLookup || !inputQuery) return;

    const performLookup = async () => {
        const query = inputQuery.value.trim();
        if (!query) {
            if (statusDiv) {
                statusDiv.textContent = 'Please enter a movie name.';
                statusDiv.className = 'lookup-status error';
                statusDiv.style.display = 'block';
            }
            return;
        }

        if (statusDiv) {
            statusDiv.textContent = 'Searching stinger metadata...';
            statusDiv.className = 'lookup-status';
            statusDiv.style.display = 'block';
        }
        btnLookup.disabled = true;
        inputQuery.disabled = true;

        const apiKey = document.getElementById('apiKey')?.value.trim() || '';
        let url = `/preview/${encodeURIComponent(query)}`;
        if (apiKey) {
            url += `?apiKey=${encodeURIComponent(apiKey)}`;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP error ${res.status}`);
            }
            const data = await res.json();
            activeTestData = data;

            if (statusDiv) {
                statusDiv.textContent = `Showing results for: "${data.title}" (${data.year || 'N/A'})`;
                statusDiv.className = 'lookup-status success';
            }

            // Sync manual test toggles for visual feedback
            document.getElementById('testMid').checked = data.mid;
            document.getElementById('testPost').checked = data.post;
            document.getElementById('testWiki').checked = data.source ? data.source.includes('Wikipedia') : false;
            document.getElementById('testBloopers').checked = data.bloopers;
            document.getElementById('testSequel').checked = data.sequel;
            document.getElementById('testRelated').checked = !!data.relatedData;

            updatePreview();
        } catch (e) {
            if (statusDiv) {
                statusDiv.textContent = `Lookup failed: ${e.message}`;
                statusDiv.className = 'lookup-status error';
            }
            activeTestData = null;
        } finally {
            btnLookup.disabled = false;
            inputQuery.disabled = false;
        }
    };

    btnLookup.addEventListener('click', performLookup);
    inputQuery.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performLookup();
        }
    });

    // Update preview when simulation checkboxes change
    const testCheckboxes = document.querySelectorAll('.test-controls input[type="checkbox"]');
    testCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            updatePreview();
        });
    });

    // Reset lookup and return to manual simulation mode if the search input is cleared
    inputQuery.addEventListener('input', () => {
        if (inputQuery.value.trim() === '') {
            if (activeTestData) {
                activeTestData = null;
                if (statusDiv) statusDiv.style.display = 'none';
                updatePreview();
            }
        }
    });
}

function initSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const card = document.querySelector('.card');

    if (!sidebarToggle || !card) return;

    try {
        const isCollapsed = localStorage.getItem('stinger_sidebar_collapsed') === 'true';
        if (isCollapsed) {
            card.classList.add('sidebar-collapsed');
        }
    } catch (e) {
        console.warn('Failed to load sidebar collapsed state from localStorage:', e);
    }

    sidebarToggle.addEventListener('click', () => {
        card.classList.toggle('sidebar-collapsed');
        const isCollapsed = card.classList.contains('sidebar-collapsed');
        try {
            localStorage.setItem('stinger_sidebar_collapsed', isCollapsed);
        } catch (e) {
            console.warn('Failed to save sidebar collapsed state to localStorage:', e);
        }
    });
}

window.onload = () => {
    initSidebarToggle();
    initCustomSelect();
    loadConfigFromLocalStorage();
    validateApiKey();
    initTestLookup();
    updatePreview();

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

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
        if (!checkbox.closest('.test-controls')) {
            checkbox.addEventListener('change', updatePreview);
        }
    });
};
