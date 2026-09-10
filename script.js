// ==========================================
// 1. 全局狀態與預設資料
// ==========================================
let records = JSON.parse(localStorage.getItem('accounting_records')) || [];
let currentType = '支出';
let selectedMainCate = '飲食';
let selectedSubCate = '食材';
let historyRange = 'month';
let selectedCategoryFilter = null;
let isHistoryCollapsed = false;

const defaultCategories = {
    '支出': {
        '飲食': ['食材', '零食&點心', '飲料', '水果', '咖啡', '酒', '早餐', '午餐', '晚餐', '其他'],
        '住家': ['房租', '水電費', '瓦斯費', '管理費', '居家用品', '修繕'],
        '電信': ['手機費', '網路費', '市話'],
        '交通': ['加油', '公車/捷運', '計程車', '停車費', '車輛保養', '高鐵/台鐵'],
        '學習': ['書籍', '課程', '文具', '報名費'],
        '娛樂': ['電影', '遊戲', '旅遊', '演唱會', '訂閱服務'],
        '購物': ['服飾', '鞋包', '美妝保養', '電子產品']
    },
    '收入': {
        '工作': ['薪資', '獎金', '兼職'],
        '投資': ['股票配息', '基金', '利息'],
        '其他': ['禮金', '退款', '中獎']
    }
};

let categories = JSON.parse(localStorage.getItem('accounting_categories')) || defaultCategories;

const chartColors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#E7E9ED', '#71B37C', '#EC644B', '#1E8BC3'
];

// 取得當前時間 HH:mm:ss 格式
function getCurrentTimeString() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

// ==========================================
// 2. 頁面初始化與自定義外觀載入
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('dateInput').valueAsDate = new Date();
    updateCateTriggerText();
    loadCustomizations();
    
    // 執行自動判斷網址參數（銀行 APP 推播/簡訊自動記帳）
    handleUrlParams();

    updateUI();
});

// ==========================================
// 2.1 網址參數自動解析（銀行/簡訊自動記帳）
// ==========================================
function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const amount = parseFloat(urlParams.get('amount'));
    const note = urlParams.get('note') || '';
    const mainCate = urlParams.get('main') || '飲食';
    const subCate = urlParams.get('sub') || '其他';
    const type = urlParams.get('type') || '支出';
    // 若網址沒帶時間參數，自動抓取進入網頁（通知抵達）的時間
    const timeVal = urlParams.get('time') || getCurrentTimeString();

    if (isNaN(amount) || amount <= 0) return;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateVal = `${yyyy}-${mm}-${dd}`;

    // 防重複機制：3 分鐘內相同金額與備註不重複寫入
    const isDuplicate = records.some(r => {
        const isSameAmount = r.amount === amount;
        const isSameNote = r.note === note;
        const isRecent = (Date.now() - r.id) < 3 * 60 * 1000;
        return isSameAmount && isSameNote && isRecent;
    });

    if (isDuplicate) {
        console.log('🛡️ 偵測到重複發送的通知，已自動過濾。');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    const newRecord = {
        id: Date.now(),
        type: type,
        date: dateVal,
        time: timeVal,
        mainCategory: mainCate,
        subCategory: subCate,
        category: subCate ? `${mainCate} > ${subCate}` : mainCate,
        amount: amount,
        note: note
    };

    records.unshift(newRecord);
    saveRecords();

    // 網址淨化
    window.history.replaceState({}, document.title, window.location.pathname);
}

// ==========================================
// 3. 側邊選單控制與外觀自定義
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const isActive = sidebar.classList.contains('active');
    
    if (isActive) {
        sidebar.classList.remove('active');
        overlay.style.display = 'none';
    } else {
        sidebar.classList.add('active');
        overlay.style.display = 'block';
    }
}

function hexToRgb(hex) {
    let cleanedHex = hex.replace('#', '');
    if (cleanedHex.length === 3) {
        cleanedHex = cleanedHex.split('').map(c => c + c).join('');
    }
    const num = parseInt(cleanedHex, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function getLuminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

function handleBgImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Img = e.target.result;
        localStorage.setItem('accounting_bg_image', base64Img);
        document.body.style.backgroundImage = `url(${base64Img})`;
    };
    reader.readAsDataURL(file);
}

function resetBgImage() {
    localStorage.removeItem('accounting_bg_image');
    document.body.style.backgroundImage = 'none';
    document.getElementById('bgImageInput').value = '';
    alert('已重置背景圖片！');
}

function handleCardColorChange() {
    const colorHex = document.getElementById('cardColorPicker').value;
    const opacity = document.getElementById('cardOpacityRange').value;
    const rgb = hexToRgb(colorHex);

    const setting = { hex: colorHex, opacity: opacity, rgb: rgb };
    localStorage.setItem('accounting_card_style', JSON.stringify(setting));

    applyCardStyle(rgb, opacity);
}

function applyCardStyle(rgbStr, opacity) {
    document.documentElement.style.setProperty('--card-rgb', rgbStr);
    document.documentElement.style.setProperty('--card-opacity', opacity);

    const [r, g, b] = rgbStr.split(',').map(n => parseInt(n.trim()));
    const luminance = getLuminance(r, g, b);

    if (luminance < 140) {
        document.documentElement.style.setProperty('--label-color', '#ffffff');
        document.documentElement.style.setProperty('--legend-text-color', '#ffffff');
    } else {
        document.documentElement.style.setProperty('--label-color', '#000000');
        document.documentElement.style.setProperty('--legend-text-color', '#000000');
    }
}

function resetCardColor() {
    localStorage.removeItem('accounting_card_style');
    document.getElementById('cardColorPicker').value = '#ffffff';
    document.getElementById('cardOpacityRange').value = '0.92';
    applyCardStyle('255, 255, 255', '0.92');
    alert('已重置面板顏色！');
}

function loadCustomizations() {
    const savedBg = localStorage.getItem('accounting_bg_image');
    if (savedBg) {
        document.body.style.backgroundImage = `url(${savedBg})`;
    }

    const savedCardStyle = localStorage.getItem('accounting_card_style');
    if (savedCardStyle) {
        try {
            const style = JSON.parse(savedCardStyle);
            document.getElementById('cardColorPicker').value = style.hex;
            document.getElementById('cardOpacityRange').value = style.opacity;
            applyCardStyle(style.rgb, style.opacity);
        } catch (e) {
            console.error(e);
        }
    } else {
        applyCardStyle('255, 255, 255', '0.92');
    }
}

// ==========================================
// 4. 記帳操作與類型切換
// ==========================================
function switchRecordType(type) {
    currentType = type;
    document.getElementById('typeExpenseBtn').classList.toggle('active', type === '支出');
    document.getElementById('typeIncomeBtn').classList.toggle('active', type === '收入');

    const mainCates = Object.keys(categories[currentType]);
    if (mainCates.length > 0) {
        selectedMainCate = mainCates[0];
        const subCates = categories[currentType][selectedMainCate];
        selectedSubCate = subCates.length > 0 ? subCates[0] : '';
    }
    updateCateTriggerText();
}

function updateCateTriggerText() {
    const triggerBtn = document.getElementById('cateTrigger');
    triggerBtn.innerText = selectedSubCate ? `${selectedMainCate} > ${selectedSubCate}` : selectedMainCate;
}

function addRecord() {
    const date = document.getElementById('dateInput').value;
    const amount = parseFloat(document.getElementById('amountInput').value);
    const note = document.getElementById('noteInput').value.trim();

    if (!date || isNaN(amount) || amount <= 0) {
        alert('請輸入正確的日期與金額！');
        return;
    }

    const newRecord = {
        id: Date.now(),
        type: currentType,
        date: date,
        time: getCurrentTimeString(),
        mainCategory: selectedMainCate,
        subCategory: selectedSubCate,
        category: selectedSubCate ? `${selectedMainCate} > ${selectedSubCate}` : selectedMainCate,
        amount: amount,
        note: note
    };

    records.unshift(newRecord);
    saveRecords();

    document.getElementById('amountInput').value = '';
    document.getElementById('noteInput').value = '';

    updateUI();
}

function deleteRecord(id) {
    if (confirm('確定要刪除這筆紀錄嗎？')) {
        records = records.filter(r => r.id !== id);
        saveRecords();
        updateUI();
    }
}

function saveRecords() {
    localStorage.setItem('accounting_records', JSON.stringify(records));
}

// ==========================================
// 5. 財務數據計算與圖表繪製
// ==========================================
function updateUI() {
    renderSummary();
    renderCharts();
    renderHistory();
}

function renderSummary() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const ymFilter = `${curYear}-${curMonth}`;

    let mInc = 0, mExp = 0, yInc = 0, yExp = 0;

    records.forEach(r => {
        const rYear = r.date.substring(0, 4);
        const rYM = r.date.substring(0, 7);

        if (rYM === ymFilter) {
            if (r.type === '收入') mInc += r.amount;
            else mExp += r.amount;
        }

        if (rYear == curYear) {
            if (r.type === '收入') yInc += r.amount;
            else yExp += r.amount;
        }
    });

    document.getElementById('dashMonthIncome').innerText = `$${mInc.toLocaleString()}`;
    document.getElementById('dashMonthExpense').innerText = `$${mExp.toLocaleString()}`;
    document.getElementById('dashMonthBalance').innerText = `$${(mInc - mExp).toLocaleString()}`;

    document.getElementById('dashYearIncome').innerText = `$${yInc.toLocaleString()}`;
    document.getElementById('dashYearExpense').innerText = `$${yExp.toLocaleString()}`;
    document.getElementById('dashYearBalance').innerText = `$${(yInc - yExp).toLocaleString()}`;
}

function renderCharts() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const ymFilter = `${curYear}-${curMonth}`;

    const monthExpData = {};
    const yearExpData = {};

    records.forEach(r => {
        if (r.type !== '支出') return;
        const rYear = r.date.substring(0, 4);
        const rYM = r.date.substring(0, 7);
        const cateKey = r.mainCategory || r.category.split(' > ')[0];

        if (rYM === ymFilter) {
            monthExpData[cateKey] = (monthExpData[cateKey] || 0) + r.amount;
        }
        if (rYear == curYear) {
            yearExpData[cateKey] = (yearExpData[cateKey] || 0) + r.amount;
        }
    });

    drawDonutChart('monthChartWrapper', 'monthLegend', monthExpData, 'month');
    drawDonutChart('yearChartWrapper', 'yearLegend', yearExpData, 'year');
}

function drawDonutChart(wrapperId, legendId, dataMap, rangeType) {
    const wrapper = document.getElementById(wrapperId);
    const legend = document.getElementById(legendId);
    wrapper.innerHTML = '';
    legend.innerHTML = '';

    const labels = Object.keys(dataMap);
    const values = Object.values(dataMap);
    const total = values.reduce((a, b) => a + b, 0);

    if (total === 0) {
        wrapper.innerHTML = '<span style="color:var(--label-color, #86868b); font-size:14px;">暫無支出紀錄</span>';
        return;
    }

    let cumulativePercent = 0;
    const slices = [];

    labels.forEach((label, index) => {
        const val = values[index];
        const percent = val / total;
        const color = chartColors[index % chartColors.length];

        const startAngle = cumulativePercent * 2 * Math.PI;
        cumulativePercent += percent;
        const endAngle = cumulativePercent * 2 * Math.PI;

        const x1 = 90 + 70 * Math.sin(startAngle);
        const y1 = 90 - 70 * Math.cos(startAngle);
        const x2 = 90 + 70 * Math.sin(endAngle);
        const y2 = 90 - 70 * Math.cos(endAngle);

        const largeArcFlag = percent > 0.5 ? 1 : 0;
        const pathData = `M 90 90 L ${x1} ${y1} A 70 70 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

        slices.push(`<path d="${pathData}" fill="${color}" />`);

        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.style.color = 'var(--legend-text-color, #1d1d1f)';
        legendItem.innerHTML = `
            <span class="legend-color" style="background-color: ${color};"></span>
            <span>${label} (${Math.round(percent * 100)}%)</span>
        `;
        legendItem.onclick = () => {
            historyRange = rangeType;
            selectedCategoryFilter = label;
            setHistoryRangeActiveUI(rangeType);
            renderHistory();
            document.getElementById('listTitle').scrollIntoView({ behavior: 'smooth' });
        };
        legend.appendChild(legendItem);
    });

    const svgHTML = `
        <svg viewBox="0 0 180 180">
            ${slices.join('')}
            <circle cx="90" cy="90" r="45" fill="var(--card-bg, rgba(var(--card-rgb), var(--card-opacity)))" />
        </svg>
    `;
    wrapper.innerHTML = svgHTML;
}

// ==========================================
// 6. 歷史明細渲染與篩選（年月日下方獨立顯示時間）
// ==========================================
function renderHistory() {
    const listEl = document.getElementById('recordList');
    const badgeBox = document.getElementById('badgeBox');
    listEl.innerHTML = '';
    badgeBox.innerHTML = '';

    if (selectedCategoryFilter) {
        const badge = document.createElement('div');
        badge.className = 'filter-badge';
        badge.innerHTML = `篩選分類: ${selectedCategoryFilter} (點擊取消) ✕`;
        badge.onclick = () => {
            selectedCategoryFilter = null;
            renderHistory();
        };
        badgeBox.appendChild(badge);
    }

    if (isHistoryCollapsed) return;

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const ymFilter = `${curYear}-${curMonth}`;

    const filteredRecords = records.filter(r => {
        let matchRange = true;
        if (historyRange === 'month') matchRange = (r.date.substring(0, 7) === ymFilter);
        else if (historyRange === 'year') matchRange = (r.date.substring(0, 4) == curYear);

        let matchCate = true;
        if (selectedCategoryFilter) {
            const cateKey = r.mainCategory || r.category.split(' > ')[0];
            matchCate = (cateKey === selectedCategoryFilter);
        }

        return matchRange && matchCate;
    });

    if (filteredRecords.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:var(--label-color, #86868b); padding:20px;">尚無紀錄</div>';
        return;
    }

    filteredRecords.forEach(r => {
        const item = document.createElement('div');
        item.className = 'record-item';
        item.style.borderLeftColor = r.type === '收入' ? '#34c759' : '#ff3b30';
        
        // 若該筆紀錄沒有時間（舊資料），自動補上預設時間點
        const displayTime = r.time || getCurrentTimeString();

        item.innerHTML = `
            <div>
                <strong>${r.category}</strong> ${r.note ? `<span style="opacity:0.75; font-size:13px;">(${r.note})</span>` : ''}
                <div class="record-date">${r.date}</div>
                <div class="record-date" style="margin-top: 2px;">${displayTime}</div>
            </div>
            <div>
                <span class="record-amount ${r.type === '收入' ? 'amt-income' : 'amt-expense'}">
                    ${r.type === '收入' ? '+' : '-'}$${r.amount.toLocaleString()}
                </span>
                <button class="btn-delete" onclick="deleteRecord(${r.id})">刪除</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

function setHistoryRange(range) {
    historyRange = range;
    selectedCategoryFilter = range === 'all' ? null : selectedCategoryFilter;
    setHistoryRangeActiveUI(range);
    renderHistory();
}

function setHistoryRangeActiveUI(range) {
    ['month', 'year', 'all'].forEach(r => {
        const btn = document.getElementById(`btnRange${r.charAt(0).toUpperCase() + r.slice(1)}`);
        if (btn) btn.classList.toggle('active', r === range);
    });
}

function toggleHistoryCollapse() {
    isHistoryCollapsed = !isHistoryCollapsed;
    document.getElementById('toggleCollapseBtn').innerText = isHistoryCollapsed ? '展開 ▼' : '收斂 ▲';
    renderHistory();
}

// ==========================================
// 7. 分類彈窗 Modal 管理
// ==========================================
function openModal() {
    renderModalCategories();
    document.getElementById('cateModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('cateModal').style.display = 'none';
}

function renderModalCategories() {
    const mainListEl = document.getElementById('mainCateList');
    const subListEl = document.getElementById('subCateList');
    mainListEl.innerHTML = '';
    subListEl.innerHTML = '';

    const currentTypeCates = categories[currentType] || {};

    Object.keys(currentTypeCates).forEach(mainCate => {
        const li = document.createElement('li');
        li.className = `cate-item ${mainCate === selectedMainCate ? 'active' : ''}`;
        li.innerText = mainCate;
        li.onclick = () => {
            selectedMainCate = mainCate;
            const subCates = currentTypeCates[mainCate] || [];
            selectedSubCate = subCates.length > 0 ? subCates[0] : '';
            renderModalCategories();
        };
        mainListEl.appendChild(li);
    });

    const currentSubCates = currentTypeCates[selectedMainCate] || [];
    currentSubCates.forEach(subCate => {
        const li = document.createElement('li');
        li.className = `cate-item ${subCate === selectedSubCate ? 'active' : ''}`;
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';

        const nameSpan = document.createElement('span');
        nameSpan.innerText = subCate;
        nameSpan.style.flex = '1';
        nameSpan.onclick = () => {
            selectedSubCate = subCate;
            updateCateTriggerText();
            closeModal();
        };

        const delBtn = document.createElement('button');
        delBtn.innerText = '✕';
        delBtn.style.cssText = 'background:none; border:none; color:#ff3b30; font-size:12px; cursor:pointer; padding:2px 6px;';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteCustomSubCate(subCate);
        };

        li.appendChild(nameSpan);
        li.appendChild(delBtn);
        subListEl.appendChild(li);
    });
}

function addCustomSubCate() {
    const newName = prompt(`請輸入要在「${selectedMainCate}」新增的子分類名稱：`);
    if (newName && newName.trim() !== '') {
        const trimmedName = newName.trim();
        if (!categories[currentType][selectedMainCate]) {
            categories[currentType][selectedMainCate] = [];
        }
        
        if (!categories[currentType][selectedMainCate].includes(trimmedName)) {
            categories[currentType][selectedMainCate].push(trimmedName);
            localStorage.setItem('accounting_categories', JSON.stringify(categories));
            selectedSubCate = trimmedName;
            renderModalCategories();
            updateCateTriggerText();
        } else {
            alert('此分類已存在！');
        }
    }
}

function deleteCustomSubCate(subCateToDelete) {
    const subList = categories[currentType][selectedMainCate];
    
    if (subList.length <= 1) {
        alert('每個主分類至少需保留一個子分類！');
        return;
    }

    if (confirm(`確定要刪除「${selectedMainCate} > ${subCateToDelete}」分類嗎？`)) {
        categories[currentType][selectedMainCate] = subList.filter(s => s !== subCateToDelete);
        localStorage.setItem('accounting_categories', JSON.stringify(categories));

        if (selectedSubCate === subCateToDelete) {
            selectedSubCate = categories[currentType][selectedMainCate][0];
            updateCateTriggerText();
        }

        renderModalCategories();
    }
}

// ==========================================
// 8. 匯出 / 匯入 CSV 備份
// ==========================================
function exportCSV() {
    if (records.length === 0) {
        alert('目前沒有紀錄可匯出！');
        return;
    }

    let csvContent = '\uFEFF日期時間,類型,分類,金額,備註\n';
    records.forEach(r => {
        const dt = r.time ? `${r.date} ${r.time}` : r.date;
        csvContent += `"${dt}","${r.type}","${r.category}",${r.amount},"${r.note || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `記帳本備份_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

function importCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            let importedCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const cols = line.split(',').map(c => c.replace(/^"|"$/g, ''));
                if (cols.length >= 4) {
                    const [dateTimeStr, type, category, amount, note] = cols;
                    const parsedAmount = parseFloat(amount);

                    if (dateTimeStr && !isNaN(parsedAmount)) {
                        const dtParts = dateTimeStr.split(' ');
                        const datePart = dtParts[0];
                        const timePart = dtParts[1] || '';

                        const cateParts = category ? category.split(' > ') : ['其他'];
                        records.push({
                            id: Date.now() + i,
                            date: datePart,
                            time: timePart,
                            type: type || '支出',
                            mainCategory: cateParts[0],
                            subCategory: cateParts[1] || '',
                            category: category,
                            amount: parsedAmount,
                            note: note || ''
                        });
                        importedCount++;
                    }
                }
            }

            records.sort((a, b) => new Date(b.date) - new Date(a.date));
            saveRecords();
            updateUI();
            alert(`成功匯入 ${importedCount} 筆資料！`);
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}