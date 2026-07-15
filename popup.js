document.addEventListener('DOMContentLoaded', () => {
  let rules = [];
  let editingId = null;

  const ruleType = document.getElementById('ruleType');
  const matchStr = document.getElementById('matchStr');
  const replaceStr = document.getElementById('replaceStr');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const rulesList = document.getElementById('rulesList');
  
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');

  // Load rules
  chrome.storage.local.get(['burpRules'], (result) => {
    rules = result.burpRules || [];
    renderRules();
  });

  // Save Rule
  saveBtn.addEventListener('click', () => {
    if (!matchStr.value.trim()) return; 

    const ruleData = {
      id: editingId || Date.now().toString(),
      type: ruleType.value,
      match: matchStr.value,
      replace: replaceStr.value,
      enabled: editingId ? rules.find(r => r.id === editingId).enabled : true
    };

    if (editingId) {
      const index = rules.findIndex(r => r.id === editingId);
      if (index > -1) rules[index] = ruleData;
    } else {
      rules.push(ruleData);
    }

    chrome.storage.local.set({ burpRules: rules.map(({ selectedForExport, ...rest }) => rest) }, () => {
      clearForm();
      renderRules();
    });
  });

  clearBtn.addEventListener('click', clearForm);

  // ==========================================
  // EXPORT LOGIC (Updated for Selection)
  // ==========================================
  exportBtn.addEventListener('click', () => {
    if (rules.length === 0) {
      alert("No rules to export!");
      return;
    }

    // Find rules that the user specifically checked for export
    const selectedRules = rules.filter(r => r.selectedForExport);
    let rulesToExport = selectedRules;

    // If they didn't check any, ask if they want to export all of them
    if (selectedRules.length === 0) {
      if (confirm("No specific rules selected. Do you want to export ALL rules?")) {
        rulesToExport = rules;
      } else {
        return; // Cancelled
      }
    }

    // Clean out the temporary "selectedForExport" flag before saving the file
    const cleanRules = rulesToExport.map(({ selectedForExport, ...rest }) => rest);

    const blob = new Blob([JSON.stringify(cleanRules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maare_rules.json'; // Updated filename
    a.click();
    URL.revokeObjectURL(url);
  });

  // ==========================================
  // IMPORT LOGIC
  // ==========================================
  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        const importedRules = Array.isArray(importedData) ? importedData : [importedData];
        
        const validRules = importedRules.filter(r => r.type && r.match).map(r => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          type: r.type,
          match: r.match,
          replace: r.replace || '',
          enabled: r.enabled !== false,
          selectedForExport: false
        }));

        if (validRules.length === 0) {
          alert("No valid rules found in the file.");
          return;
        }

        rules = rules.concat(validRules);
        chrome.storage.local.set({ burpRules: rules }, () => {
          renderRules();
          importFile.value = ''; 
          alert(`Successfully imported ${validRules.length} rule(s)!`);
        });

      } catch (err) {
        alert("Failed to read file. Make sure it is a valid JSON file.");
      }
    };
    reader.readAsText(file);
  });

  // ==========================================
  // UI RENDERING
  // ==========================================
  function clearForm() {
    editingId = null;
    matchStr.value = '';
    replaceStr.value = '';
    saveBtn.innerText = "Add Rule";
    clearBtn.style.display = "none";
  }

  function renderRules() {
    rulesList.innerHTML = '';
    
    if (rules.length === 0) {
      rulesList.innerHTML = '<div style="text-align:center; color:#888; font-size: 11px; padding: 10px;">No rules found.</div>';
      return;
    }

    rules.forEach(rule => {
      const div = document.createElement('div');
      div.className = `rule-item ${rule.enabled ? '' : 'disabled'}`;

      // Left Checkbox: Enable/Disable the rule
      const enableCb = document.createElement('input');
      enableCb.type = 'checkbox';
      enableCb.title = 'Enable/Disable Rule';
      enableCb.checked = rule.enabled;
      enableCb.onchange = () => {
        rule.enabled = enableCb.checked;
        chrome.storage.local.set({ burpRules: rules }, renderRules);
      };

      const info = document.createElement('div');
      info.className = 'rule-info';
      const typeLabel = document.createElement('strong');
      typeLabel.textContent = rule.type.replace(/_/g, ' ');
      info.appendChild(typeLabel);
      info.appendChild(document.createTextNode(`${rule.match} → ${rule.replace}`));
      info.title = `Match: ${rule.match}\nReplace: ${rule.replace}`;

      // Right Action Group Wrapper
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.alignItems = 'center';
      actionsDiv.style.gap = '2px';

      // NEW: Select for Export Checkbox
      const exportCb = document.createElement('input');
      exportCb.type = 'checkbox';
      exportCb.className = 'export-cb';
      exportCb.title = 'Select rule for Export';
      exportCb.checked = rule.selectedForExport || false;
      exportCb.onchange = () => {
        rule.selectedForExport = exportCb.checked;
      };

      const divider = document.createElement('div');
      divider.className = 'action-divider';

      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn icon-edit';
      editBtn.textContent = '\u270E';
      editBtn.title = 'Edit Rule';
      editBtn.onclick = () => {
        editingId = rule.id;
        ruleType.value = rule.type;
        matchStr.value = rule.match;
        replaceStr.value = rule.replace;
        saveBtn.innerText = "Save Changes";
        clearBtn.style.display = "block";
      };

      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn icon-delete';
      delBtn.textContent = '\u274C';
      delBtn.title = 'Delete Rule';
      delBtn.onclick = () => {
        rules = rules.filter(r => r.id !== rule.id);
        chrome.storage.local.set({ burpRules: rules }, renderRules);
        if (editingId === rule.id) clearForm();
      };

      actionsDiv.append(exportCb, divider, editBtn, delBtn);
      div.append(enableCb, info, actionsDiv);
      rulesList.appendChild(div);
    });
  }
});