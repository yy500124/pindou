// 颜色配置
const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#FF69B4',
    '#00CED1', '#FF8C00', '#FFD700', '#FF4500',
    '#000000', '#333333', '#666666', '#999999',
    '#CCCCCC', '#FFFFFF', '#E74C3C', '#3498DB'
];

// 当前选中的颜色
let currentColor = '#FF6B6B';
// 是否处于橡皮擦模式
let isEraseMode = false;
// 是否正在绘制
let isDrawing = false;
// 网格大小
let gridSize = 15;
// 历史记录（撤销）
let undoStack = [];

// DOM元素
const colorGrid = document.getElementById('colorGrid');
const colorPreview = document.getElementById('colorPreview');
const pixelGrid = document.getElementById('pixelGrid');
const gridSizeSelect = document.getElementById('gridSize');
const clearBtn = document.getElementById('clearBtn');
const fillBtn = document.getElementById('fillBtn');
const eraseBtn = document.getElementById('eraseBtn');
const undoBtn = document.getElementById('undoBtn');

// 初始化颜色选择区
function initColorGrid() {
    colorGrid.innerHTML = '';
    COLORS.forEach(color => {
        const colorBlock = document.createElement('div');
        colorBlock.className = 'color-block';
        colorBlock.style.backgroundColor = color;
        colorBlock.addEventListener('click', () => selectColor(color));
        colorGrid.appendChild(colorBlock);
    });
    // 默认选中第一个颜色
    selectColor(COLORS[0]);
}

// 选择颜色
function selectColor(color) {
    currentColor = color;
    colorPreview.style.backgroundColor = color;
    
    // 更新选中状态
    const colorBlocks = colorGrid.querySelectorAll('.color-block');
    colorBlocks.forEach(block => {
        block.classList.remove('selected');
        if (block.style.backgroundColor === color) {
            block.classList.add('selected');
        }
    });
    
    // 如果在橡皮擦模式，退出橡皮擦模式
    if (isEraseMode) {
        toggleEraseMode();
    }
}

// 生成像素网格
function generatePixelGrid(size) {
    pixelGrid.innerHTML = '';
    pixelGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    pixelGrid.style.gridTemplateRows = `repeat(${size}, 1fr)`;
    
    // 根据容器大小计算单元格尺寸
    const containerWidth = Math.min(500, window.innerWidth - 60);
    const cellSize = Math.floor((containerWidth - (size - 1) - 6) / size);
    
    // 字号根据格子大小自适应
    const fontSize = Math.max(8, Math.floor(cellSize * 0.4));

    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.className = 'pixel-cell';
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        cell.style.fontSize = `${fontSize}px`;
        cell.textContent = String(i + 1);
        
        // 绑定事件
        cell.addEventListener('mousedown', () => startDrawing(cell));
        cell.addEventListener('mouseenter', () => draw(cell));
        cell.addEventListener('mouseup', stopDrawing);
        
        // 触摸事件支持
        cell.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrawing(cell);
        });
        cell.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target && target.classList.contains('pixel-cell')) {
                draw(target);
            }
        });
        cell.addEventListener('touchend', stopDrawing);
        
        pixelGrid.appendChild(cell);
    }
}

// 根据背景色返回对比色（黑或白），保证数字可见（支持 hex 和 rgb 格式）
function getContrastColor(color) {
    let r, g, b;
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
    } else {
        const m = color.match(/\d+/g);
        if (!m) return '#000000';
        r = +m[0]; g = +m[1]; b = +m[2];
    }
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
}

// 判断是否为白色/空背景
function isBlankColor(bgColor) {
    return !bgColor || bgColor === 'rgb(255, 255, 255)' || bgColor.toLowerCase() === '#ffffff';
}

// 统一设置格子背景色并同步数字对比色
function applyCellColor(cell, bgColor) {
    cell.style.backgroundColor = bgColor;
    cell.style.color = isBlankColor(bgColor) ? '#bbb' : getContrastColor(bgColor);
}

// 获取当前网格颜色快照
function getSnapshot() {
    return Array.from(pixelGrid.children).map(cell => cell.style.backgroundColor);
}

// 从快照恢复网格
function restoreSnapshot(snapshot) {
    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    cells.forEach((cell, i) => {
        applyCellColor(cell, snapshot[i] || '');
    });
}

// 保存当前状态到撤销栈（绘制操作前调用）
function pushHistory() {
    undoStack.push(getSnapshot());
    updateUndoRedoButtons();
}

// 更新撤销按钮的可用状态
function updateUndoRedoButtons() {
    undoBtn.disabled = undoStack.length === 0;
}

// 撤销
function undo() {
    if (undoStack.length === 0) return;
    restoreSnapshot(undoStack.pop());
    updateUndoRedoButtons();
}

// 开始绘制
function startDrawing(cell) {
    pushHistory();
    isDrawing = true;
    draw(cell);
}

// 绘制
function draw(cell) {
    if (isDrawing) {
        applyCellColor(cell, isEraseMode ? '#FFFFFF' : currentColor);
    }
}

// 停止绘制
function stopDrawing() {
    isDrawing = false;
}

// 清空画布
function clearCanvas() {
    pushHistory();
    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    cells.forEach(cell => applyCellColor(cell, '#FFFFFF'));
}

// 填充全部
function fillCanvas() {
    pushHistory();
    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    cells.forEach(cell => applyCellColor(cell, currentColor));
}

// 切换橡皮擦模式
function toggleEraseMode() {
    isEraseMode = !isEraseMode;
    eraseBtn.classList.toggle('active');
    
    if (isEraseMode) {
        eraseBtn.style.background = 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)';
        colorPreview.style.borderColor = '#e74c3c';
        colorPreview.innerHTML = '<span style="color:#e74c3c;font-weight:bold;font-size:12px">✕</span>';
    } else {
        eraseBtn.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        colorPreview.style.borderColor = '#ddd';
        colorPreview.innerHTML = '';
    }
}

// 网格大小改变
function onGridSizeChange() {
    gridSize = parseInt(gridSizeSelect.value);
    generatePixelGrid(gridSize);
    // 网格尺寸变化后历史快照失效，清空历史
    undoStack = [];
    updateUndoRedoButtons();
}

// 窗口大小改变时重新生成网格
function onWindowResize() {
    generatePixelGrid(gridSize);
}

// 初始化
function init() {
    initColorGrid();
    generatePixelGrid(gridSize);
    
    // 绑定事件
    clearBtn.addEventListener('click', clearCanvas);
    fillBtn.addEventListener('click', fillCanvas);
    eraseBtn.addEventListener('click', toggleEraseMode);
    undoBtn.addEventListener('click', undo);
    gridSizeSelect.addEventListener('change', onGridSizeChange);
    window.addEventListener('resize', onWindowResize);

    // 键盘快捷键：Ctrl+Z 撤销
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
    });

    updateUndoRedoButtons();
    
    // 全局鼠标/触摸事件
    document.addEventListener('mouseup', stopDrawing);
    document.addEventListener('touchend', stopDrawing);
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}