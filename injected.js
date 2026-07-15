let activeRules = [];

// Listen for the rules array from the content script
window.addEventListener('message', function(event) {
    if (event.source !== window || !event.data) return;
    if (event.data.action === 'SET_RULES') {
        // Filter out disabled rules immediately
        activeRules = (event.data.rules || []).filter(r => r.enabled);
    }
});

// Check if we need to process a specific type to save processing power
function hasRuleType(type) {
    return activeRules.some(r => r.type === type && r.match);
}

// Sequentially apply all matching rules to a string
function applyRules(str, type) {
    if (typeof str !== 'string') return str;
    let result = str;
    activeRules.forEach(rule => {
        if (rule.type === type && rule.match) {
            result = result.split(rule.match).join(rule.replace);
        }
    });
    return result;
}

const isUrlModifier = (type) => ['request_param_name', 'request_param_value', 'request_first_line'].includes(type);

// ==========================================
// 1. OVERRIDE FETCH API
// ==========================================
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    let url = args[0];
    let options = args[1] || {};

    // 1. URL & First Line modifications
    if (hasRuleType('request_param_name') || hasRuleType('request_param_value') || hasRuleType('request_first_line')) {
        let origUrl = typeof url === 'string' ? url : url.url;
        let newUrl = origUrl;
        
        ['request_param_name', 'request_param_value', 'request_first_line'].forEach(t => {
            newUrl = applyRules(newUrl, t);
        });

        if (newUrl !== origUrl) {
            url = typeof url === 'string' ? newUrl : new Request(newUrl, url);
        }
        
        if (options.method && hasRuleType('request_first_line')) {
            options.method = applyRules(options.method, 'request_first_line');
        }
    }

    // 2. Request Headers
    if (hasRuleType('request_header')) {
        let tempHeaders = new Headers(options.headers || (url instanceof Request ? url.headers : {}));
        let newHeaders = new Headers();
        for (let [key, value] of tempHeaders.entries()) {
            newHeaders.append(applyRules(key, 'request_header'), applyRules(value, 'request_header'));
        }
        options.headers = newHeaders;
    }

    // 3. Request Body
    if (hasRuleType('request_body') && options.body && typeof options.body === 'string') {
        options.body = applyRules(options.body, 'request_body');
    }

    args[0] = url;
    if (args.length > 1 || Object.keys(options).length > 0) args[1] = options;

    const response = await originalFetch.apply(this, args);

    // 4. Response Modifications
    if (hasRuleType('response_body') || hasRuleType('response_header')) {
        let body = await response.clone().text();
        let headers = new Headers(response.headers);

        if (hasRuleType('response_body')) {
            body = applyRules(body, 'response_body');
        }

        if (hasRuleType('response_header')) {
            let newHeaders = new Headers();
            for (let [key, value] of headers.entries()) {
                newHeaders.append(applyRules(key, 'response_header'), applyRules(value, 'response_header'));
            }
            headers = newHeaders;
        }

        return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: headers
        });
    }

    return response;
};

// ==========================================
// 2. OVERRIDE XMLHTTPREQUEST (XHR) API
// ==========================================
const XHR = XMLHttpRequest.prototype;
const originalOpen = XHR.open;
const originalSend = XHR.send;
const originalSetRequestHeader = XHR.setRequestHeader;
const originalGetAllResponseHeaders = XHR.getAllResponseHeaders;
const originalGetResponseHeader = XHR.getResponseHeader;

XHR.open = function(method, url, ...rest) {
    if (hasRuleType('request_param_name') || hasRuleType('request_param_value') || hasRuleType('request_first_line')) {
        if (typeof url === 'string') {
            ['request_param_name', 'request_param_value', 'request_first_line'].forEach(t => {
                url = applyRules(url, t);
            });
        }
        if (typeof method === 'string' && hasRuleType('request_first_line')) {
            method = applyRules(method, 'request_first_line');
        }
    }
    return originalOpen.call(this, method, url, ...rest);
};

XHR.setRequestHeader = function(header, value) {
    if (hasRuleType('request_header')) {
        header = applyRules(header, 'request_header');
        value = applyRules(value, 'request_header');
    }
    return originalSetRequestHeader.call(this, header, value);
};

XHR.getAllResponseHeaders = function() {
    let headers = originalGetAllResponseHeaders.call(this);
    if (hasRuleType('response_header') && headers) {
        return applyRules(headers, 'response_header');
    }
    return headers;
};

XHR.getResponseHeader = function(name) {
    let value = originalGetResponseHeader.call(this, name);
    if (hasRuleType('response_header') && value) {
        return applyRules(value, 'response_header');
    }
    return value;
};

XHR.send = function(body) {
    if (hasRuleType('request_body') && typeof body === 'string') {
        body = applyRules(body, 'request_body');
    }

    this.addEventListener('readystatechange', function() {
        if (this.readyState === 4 && hasRuleType('response_body')) {
            try {
                if (this.responseText) {
                    const newText = applyRules(this.responseText, 'response_body');
                    if (newText !== this.responseText) {
                        Object.defineProperty(this, 'responseText', { writable: true, value: newText });
                        if (this.responseType === '' || this.responseType === 'text') {
                            Object.defineProperty(this, 'response', { writable: true, value: newText });
                        } else if (this.responseType === 'json') {
                            try { Object.defineProperty(this, 'response', { writable: true, value: JSON.parse(newText) }); } catch (_) {}
                        }
                    }
                }
            } catch (e) {
                // Ignore DOM exceptions for non-text responseTypes
            }
        }
    });

    return originalSend.call(this, body);
};